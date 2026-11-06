# HK Doors — ایپ کی حفاظت اور Google Play پر ڈالنے کا طریقہ

## 1. آپ کی ایپ کہاں کہاں محفوظ ہے

| چیز | کہاں ہے | کیسے محفوظ رکھیں |
|---|---|---|
| **ایپ کا پورا کوڈ** | GitHub: `github.com/waqasali300300-hue/Waqas-DOOR` | GitHub اکاؤنٹ کا پاسورڈ اور 2-step verification |
| **کوڈ کی کاپی (zip)** | آپ کو بھیجی گئی `HK-Doors-App-Source-....zip` | Google Drive اور کسی USB میں رکھیں |
| **ایپ فائل (APK)** | `releases/download/apk-latest/HK-Doors.apk` | ہر نئے ورژن کی کاپی Drive میں |
| **Google Play فائل (AAB)** | `releases/download/apk-latest/HK-Doors-PlayStore.aab` | Play Console میں اپلوڈ کریں |
| **آپ کا سارا ڈیٹا** | آپ کا Firebase پروجیکٹ `hkw-doors` + روز کی کاپیاں | Gmail کا پاسورڈ اور 2-step verification |
| **APK کا دستخطی پاسورڈ** | GitHub → Settings → Secrets → `APK_SIGN_PASSWORD` | کاغذ پر لکھ کر محفوظ جگہ پر |

> ⚠️ **APK_SIGN_PASSWORD** کبھی نہ بھولیں اور نہ بدلیں۔ اسی سے ایپ کا دستخط بنتا ہے۔ پاسورڈ بدلا تو پرانی ایپ پر نئی انسٹال نہیں ہوگی۔

کوڈ کی zip فائل سے کوئی بھی ڈویلپر یہ ایپ دوبارہ بنا سکتا ہے۔ اس میں `android-app` فولڈر APK اور AAB بنانے کا طریقہ ہے، اور `.github/workflows/apk.yml` خودکار بنانے کا۔

---

## 2. Google Play Store پر ڈالنے کا طریقہ

### قدم 1: Google Play Console اکاؤنٹ (ایک بار)
1. کمپیوٹر یا فون کے Chrome میں کھولیں: **play.google.com/console**
2. اپنی Gmail سے سائن اِن کریں۔
3. **Personal** (ذاتی) اکاؤنٹ چنیں۔
4. **25 ڈالر** (ایک بار) ATM/Debit کارڈ سے ادا کریں۔
5. شناختی کارڈ (CNIC) اور فون نمبر کی تصدیق کریں۔ اس میں 1 سے 3 دن لگ سکتے ہیں۔

### قدم 2: نئی ایپ بنائیں
1. **Create app** دبائیں۔
2. App name: `HK Doors — Wood Door ERP`
3. Default language: English (یا Urdu)
4. **App** اور **Free** چنیں۔
5. نیچے کی شرطوں پر ✓ لگا کر **Create app** دبائیں۔

### قدم 3: Dashboard کے کام (ایک ایک کر کے)
- **Privacy policy:** `https://waqasali300300-hue.github.io/Waqas-DOOR/privacy.html`
- **App access:** "All functionality is available without special access"
- **Ads:** No (ایپ میں اشتہار نہیں)
- **Content rating:** سوالنامہ بھریں۔ Category: Utility/Productivity، سب سوالوں کا جواب No۔
- **Target audience:** 18 سال اور اس سے اوپر
- **News app:** No
- **Data safety** (یہ جواب دیں):
  - Data collected: **Yes**
  - Personal info: Name، Phone number، Address
  - Photos
  - Financial info: Other financial info (کھاتے کی رقمیں)
  - Purpose: **App functionality**
  - Shared with third parties: **No**
  - Encrypted in transit: **Yes**
  - Users can request deletion: **Yes**
- **App category:** Business
- **Contact email:** اپنی Gmail

### قدم 4: Store listing (دکان کا صفحہ)
zip فائل کے `store` فولڈر میں سب تیار ہے:
- **App icon (512×512):** `icon-512.png`
- **Feature graphic (1024×500):** `store/feature-graphic-1024x500.png`
- **Phone screenshots:** `store/screenshot-1-home.png` سے `screenshot-5-khata.png`
- **Short اور Full description:** `store/listing.txt` سے کاپی کر کے پیسٹ کریں۔

### قدم 5: پہلے ٹیسٹنگ (Google کی شرط)
نئے **Personal** اکاؤنٹ کے لیے Google کی شرط ہے کہ پہلے **کم از کم 12 لوگ 14 دن** تک ایپ ٹیسٹ کریں:
1. **Testing → Closed testing → Create track**
2. **Testers:** 12 یا زیادہ Gmail ایڈریس ڈالیں (دوست، رشتہ دار، اسٹاف)
3. **Create new release** → **Upload** → `HK-Doors-PlayStore.aab` (اوپر والے لنک سے ڈاؤن لوڈ کریں)
4. **Play App Signing:** "Use Google-generated key" (پہلے سے چنا ہوگا) رہنے دیں
5. **Next → Save → Send for review**
6. ٹیسٹرز کو لنک بھیجیں اور وہ 14 دن تک ایپ استعمال کرتے رہیں۔

### قدم 6: سب کے لیے (Production)
1. 14 دن بعد **Dashboard → Apply for production** دبائیں اور چند سوالوں کے جواب دیں۔
2. منظوری کے بعد **Production → Create new release** → وہی AAB اپلوڈ کریں → **Rollout**۔
3. Google کا جائزہ 1 سے 7 دن میں ہوتا ہے، پھر ایپ Play Store پر آ جائے گی۔

### قدم 7: نیا ورژن ڈالنا (ہر اپڈیٹ کے بعد)
1. ہر نئی تبدیلی کے بعد نئی AAB خود بنتی ہے، اسی لنک پر:
   `github.com/waqasali300300-hue/Waqas-DOOR/releases/download/apk-latest/HK-Doors-PlayStore.aab`
2. Play Console → **Production → Create new release** → نئی AAB اپلوڈ → **Rollout**۔
3. ورژن نمبر خود بڑھتا ہے، آپ کو کچھ بدلنا نہیں پڑے گا۔

---

## 3. ضروری باتیں
- **APK والی ایپ اور Play والی ایپ ایک ہی فون پر:** Play والی ایپ انسٹال کرنے سے پہلے پرانی APK والی ہٹانی پڑے گی، کیونکہ Google اپنا دستخط لگاتا ہے۔ ڈیٹا کلاؤڈ میں محفوظ ہے: نئی ایپ میں Gmail اور پاسورڈ سے لاگ اِن کریں تو سب واپس آ جائے گا۔
- **Play والی ایپ** میں "نیا ورژن آ گیا" والا پیلا بٹن نہیں آتا، کیونکہ اسے Play خود اپڈیٹ کرتا ہے۔
- **GitHub repository** ابھی عوامی (public) ہے، کیونکہ مفت GitHub Pages (آن لائن ایپ، کیٹلاگ اور لنک) اسی سے چلتا ہے۔ کوڈ دوسرے دیکھ سکتے ہیں، مگر **آپ کا ڈیٹا نہیں**۔ وہ صرف آپ کے Firebase میں ہے اور آپ کے لاگ اِن سے کھلتا ہے۔
- zip فائل ہر چند مہینے بعد نئی بنوا لیں، تاکہ تازہ کوڈ آپ کے پاس رہے۔
