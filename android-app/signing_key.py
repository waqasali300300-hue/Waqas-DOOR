# Makes the APK signing key from one password (the APK_SIGN_PASSWORD secret).
# The same password always gives the same key and certificate, so every new APK
# installs over the old one. Nothing secret is stored in the repository.
#
#   APK_SIGN_PASSWORD=... python3 signing_key.py OUT_DIR   → OUT_DIR/key.pk8, OUT_DIR/cert.der
import datetime, hashlib, os, sys
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

E = 65537
SMALL_PRIMES = [p for p in range(3, 2000) if all(p % d for d in range(2, int(p ** .5) + 1))]


class Stream:
    """Endless bytes from the password (counter-mode SHA-256 over a slow hash of it)."""
    def __init__(self, password):
        self.seed = hashlib.pbkdf2_hmac('sha256', password.encode(), b'hk-doors-apk-v1', 300000)
        self.n = 0

    def bits(self, k):
        out = b''
        while len(out) * 8 < k:
            out += hashlib.sha256(self.seed + self.n.to_bytes(8, 'big')).digest()
            self.n += 1
        return int.from_bytes(out, 'big') >> (len(out) * 8 - k)


def probable_prime(n, rnd):
    if any(n % p == 0 for p in SMALL_PRIMES):
        return False
    d, s = n - 1, 0
    while d % 2 == 0:
        d //= 2
        s += 1
    for _ in range(40):
        a = 2 + rnd.bits(n.bit_length() - 1) % (n - 3)
        x = pow(a, d, n)
        if x in (1, n - 1):
            continue
        for _ in range(s - 1):
            x = pow(x, 2, n)
            if x == n - 1:
                break
        else:
            return False
    return True


def prime(bits, rnd):
    while True:
        c = rnd.bits(bits) | (3 << (bits - 2)) | 1
        if (c - 1) % E and probable_prime(c, rnd):
            return c


def main():
    password = os.environ.get('APK_SIGN_PASSWORD', '')
    if len(password) < 8:
        sys.exit('APK_SIGN_PASSWORD secret is missing or shorter than 8 characters.')
    out = sys.argv[1]
    rnd = Stream(password)
    p, q = prime(1536, rnd), prime(1536, rnd)
    if p < q:
        p, q = q, p
    n = p * q
    d = pow(E, -1, (p - 1) * (q - 1))
    key = rsa.RSAPrivateNumbers(p, q, d, rsa.rsa_crt_dmp1(d, p), rsa.rsa_crt_dmq1(d, q),
                                rsa.rsa_crt_iqmp(p, q), rsa.RSAPublicNumbers(E, n)).private_key()
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'HK Wood Doors'),
                      x509.NameAttribute(NameOID.ORGANIZATION_NAME, 'HK Wood Doors'),
                      x509.NameAttribute(NameOID.COUNTRY_NAME, 'PK')])
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
            .serial_number(n % (1 << 63) | 1)
            .not_valid_before(datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc))
            .not_valid_after(datetime.datetime(2076, 1, 1, tzinfo=datetime.timezone.utc))
            .sign(key, hashes.SHA256()))  # RSA PKCS#1 v1.5: same input → same signature
    with open(os.path.join(out, 'key.pk8'), 'wb') as f:
        f.write(key.private_bytes(serialization.Encoding.DER, serialization.PrivateFormat.PKCS8,
                                  serialization.NoEncryption()))
    with open(os.path.join(out, 'cert.der'), 'wb') as f:
        f.write(cert.public_bytes(serialization.Encoding.DER))
    print('Signing certificate SHA-256:', hashlib.sha256(cert.public_bytes(serialization.Encoding.DER)).hexdigest())


if __name__ == '__main__':
    main()
