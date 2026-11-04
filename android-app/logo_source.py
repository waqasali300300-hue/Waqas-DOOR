import sys
def svg(maskable=False):
    content=f'''
  <!-- warm light spilling onto the floor -->
  <path d="M470 846 L720 846 L860 980 L300 980 Z" fill="url(#spill)" filter="url(#blur18)" opacity=".85"/>
  <ellipse cx="512" cy="872" rx="300" ry="34" fill="#000" opacity=".35" filter="url(#blur18)"/>
  <!-- frame (gold, bevelled) -->
  <g filter="url(#drop)">
    <!-- frame thickness (extruded back face) -->
    <rect x="304" y="186" width="452" height="700" rx="26" fill="#6b4813"/>
    <path d="M738 194 L756 212 L756 860 L738 868 Z" fill="#8a5e1c"/>
    <rect x="286" y="168" width="452" height="700" rx="26" fill="url(#gold)"/>
    <rect x="300" y="182" width="424" height="672" rx="18" fill="none" stroke="#fff3c9" stroke-opacity=".55" stroke-width="4"/>
    <rect x="322" y="204" width="380" height="650" rx="10" fill="#5a3a12"/>
  </g>
  <!-- doorway: glowing inside -->
  <rect x="330" y="212" width="364" height="642" rx="8" fill="url(#glow)"/>
  <rect x="330" y="212" width="364" height="642" rx="8" fill="url(#rays)" opacity=".6"/>
  <!-- depth of the doorway: inner side and top of the frame -->
  <path d="M694 212 L694 854 L664 830 L664 236 Z" fill="#c07a22" opacity=".55"/>
  <path d="M330 212 L694 212 L664 236 L356 236 Z" fill="#8a5414" opacity=".45"/>
  <!-- door leaf, swung open toward us (perspective) -->
  <g filter="url(#leafShadow)">
    <path d="M330 212 L506 262 L506 806 L330 854 Z" fill="url(#wood)"/>
    <path d="M506 262 L530 256 L530 812 L506 806 Z" fill="url(#edge)"/>
    <!-- raised panels -->
    <path d="M356 262 L480 292 L480 512 L356 506 Z" fill="url(#panel)"/>
    <path d="M356 262 L480 292 L480 300 L356 272 Z" fill="#000" opacity=".25"/>
    <path d="M356 506 L480 512 L480 504 L356 498 Z" fill="#ffd9a0" opacity=".35"/>
    <path d="M356 556 L480 560 L480 768 L356 800 Z" fill="url(#panel)"/>
    <path d="M356 556 L480 560 L480 568 L356 566 Z" fill="#000" opacity=".25"/>
    <path d="M356 800 L480 768 L480 760 L356 790 Z" fill="#ffd9a0" opacity=".35"/>
    <!-- wood grain -->
    <path d="M372 330 Q 420 340 466 320 M372 400 Q 420 410 466 392 M372 620 Q 420 630 466 612 M372 690 Q 420 700 466 684" stroke="#3b200b" stroke-opacity=".25" stroke-width="3" fill="none"/>
    <!-- brass knob -->
    <ellipse cx="482" cy="540" rx="15" ry="17" fill="url(#brass)"/>
    <ellipse cx="477" cy="533" rx="5" ry="5" fill="#fff" opacity=".85"/>
  </g>
  <!-- sparkles -->
  <g fill="#fff6d6">
    <path d="M800 250 l8 22 22 8 -22 8 -8 22 -8 -22 -22 -8 22 -8z" opacity=".95"/>
    <path d="M226 380 l5 14 14 5 -14 5 -5 14 -5 -14 -14 -5 14 -5z" opacity=".75"/>
    <path d="M770 620 l4 11 11 4 -11 4 -4 11 -4 -11 -11 -4 11 -4z" opacity=".6"/>
  </g>'''
    bg_shape='<rect width="1024" height="1024" fill="url(#bg)"/>' if maskable else '<rect x="24" y="24" width="976" height="976" rx="220" fill="url(#bg)"/>'
    gloss='' if maskable else '<rect x="24" y="24" width="976" height="976" rx="220" fill="url(#gloss)"/><rect x="26" y="26" width="972" height="972" rx="218" fill="none" stroke="#ffffff" stroke-opacity=".18" stroke-width="4"/>'
    scale='translate(512 520) scale(.74) translate(-512 -520)' if maskable else 'translate(512 512) scale(.96) translate(-512 -512)'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs>
  <radialGradient id="bg" cx="35%" cy="25%" r="85%"><stop offset="0" stop-color="#2d63ad"/><stop offset=".45" stop-color="#173a6e"/><stop offset="1" stop-color="#08152b"/></radialGradient>
  <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset=".25" stop-color="#e8b85a"/><stop offset=".55" stop-color="#c8963e"/><stop offset=".8" stop-color="#8f6420"/><stop offset="1" stop-color="#e2b45c"/></linearGradient>
  <radialGradient id="glow" cx="60%" cy="45%" r="75%"><stop offset="0" stop-color="#fffbe6"/><stop offset=".35" stop-color="#ffe08a"/><stop offset=".75" stop-color="#f2a93b"/><stop offset="1" stop-color="#b86a14"/></radialGradient>
  <linearGradient id="rays" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="spill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd877" stop-opacity=".9"/><stop offset="1" stop-color="#ffd877" stop-opacity="0"/></linearGradient>
  <linearGradient id="wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a3014"/><stop offset=".55" stop-color="#8b5326"/><stop offset="1" stop-color="#a8692f"/></linearGradient>
  <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9c5f2b"/><stop offset="1" stop-color="#6a3a17"/></linearGradient>
  <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3e2010"/><stop offset="1" stop-color="#6d3f1b"/></linearGradient>
  <radialGradient id="brass" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#fff4c2"/><stop offset=".5" stop-color="#e0ad48"/><stop offset="1" stop-color="#7a5212"/></radialGradient>
  <filter id="drop" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000" flood-opacity=".45"/></filter>
  <filter id="leafShadow" x="-30%" y="-20%" width="160%" height="140%"><feDropShadow dx="22" dy="10" stdDeviation="14" flood-color="#2b1300" flood-opacity=".55"/></filter>
  <filter id="blur18"><feGaussianBlur stdDeviation="18"/></filter>
</defs>
{bg_shape}{gloss}
<g transform="{scale}">{content}</g>
</svg>'''
open('icon.svg','w').write(svg(False));open('maskable.svg','w').write(svg(True))
