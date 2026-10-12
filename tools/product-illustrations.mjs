// Additional illustrations use the original 1000 × 800 stage and gradient materials.
export function productShape(slug, group, rear, index) {
  const product = 'fill="url(#product)"';
  const metal = 'stroke="url(#metal)"';
  const detail = rear
    ? '<g fill="#17212A"><rect x="435" y="537" width="45" height="12" rx="4"/><rect x="500" y="537" width="18" height="12" rx="4"/><circle cx="550" cy="543" r="6"/></g>'
    : '';
  const speaker = (x, y, r) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="#17212A" opacity=".65"/><circle cx="${x}" cy="${y}" r="${r * 0.65}" fill="none" ${metal} stroke-width="12"/>`;
  if (/earbuds|in-ear/.test(slug))
    return `<rect x="350" y="440" width="300" height="150" rx="64" ${product}/><path d="M368 484h264" ${metal} stroke-width="4"/><g ${product}><path d="M365 290c-75-35-98 65-27 82l20 120h45l-12-153z"/><path d="M635 290c75-35 98 65 27 82l-20 120h-45l12-153z"/></g><g fill="#17212A"><ellipse cx="352" cy="330" rx="21" ry="30"/><ellipse cx="648" cy="330" rx="21" ry="30"/></g>${detail}`;
  if (slug === 'headphone-stand')
    return `<ellipse cx="500" cy="595" rx="160" ry="30" ${product}/><path d="M475 585V250q0-45 65-45h80" fill="none" ${metal} stroke-width="35" stroke-linecap="round"/><path d="M460 230h170" ${metal} stroke-width="12"/>`;
  if (slug === 'compact-dac' || /hub|adapter|gan-charger|power-bank|power-strip/.test(slug))
    return `<rect x="335" y="265" width="330" height="310" rx="${slug.includes('adapter') ? 40 : 25}" ${product}/><rect x="365" y="300" width="270" height="145" rx="14" fill="#17212A" opacity=".7"/><g fill="#17212A">${[0, 1, 2].map((i) => `<rect x="${400 + i * 70}" y="${rear ? 470 : 365}" width="45" height="16" rx="5"/>`).join('')}</g><path d="M390 535h100" ${metal} stroke-width="6"/>`;
  if (group === 0)
    return `<path d="M310 380v-82a190 190 0 0 1 380 0v82" fill="none" ${metal} stroke-width="${slug.includes('studio') ? 32 : 42}" stroke-linecap="round"/><rect x="272" y="365" width="100" height="180" rx="48" ${product}/><rect x="628" y="365" width="100" height="180" rx="48" ${product}/>${rear ? '<path d="M291 470h60m298 0h60" stroke="#17212A" stroke-width="8"/>' : '<ellipse cx="330" cy="455" rx="22" ry="67" fill="#17212A" opacity=".6"/><ellipse cx="670" cy="455" rx="22" ry="67" fill="#17212A" opacity=".6"/>'}${slug.includes('gaming') ? '<path d="M290 470q-15 90 155 85" fill="none" stroke="#17212A" stroke-width="14"/>' : ''}`;
  if (slug === 'turntable')
    return `<path d="M250 340h500l45 240H205z" ${product}/><ellipse cx="462" cy="440" rx="160" ry="80" fill="#17212A"/><ellipse cx="462" cy="440" rx="140" ry="65" fill="none" ${metal} stroke-width="9"/><ellipse cx="462" cy="440" rx="35" ry="17" fill="url(#metal)"/><path d="M686 372l-80 118-100 10" fill="none" ${metal} stroke-width="11"/>`;
  if (/soundbar/.test(slug))
    return `<rect x="170" y="365" width="660" height="180" rx="36" ${product}/><rect x="205" y="390" width="590" height="130" rx="25" fill="#17212A" opacity=".5"/>${speaker(290, 455, 48)}${speaker(710, 455, 48)}${detail}`;
  if (/stereo/.test(slug))
    return `<rect x="265" y="285" width="205" height="310" rx="25" ${product}/><rect x="530" y="285" width="205" height="310" rx="25" ${product}/>${rear ? detail : speaker(367, 460, 65) + speaker(632, 460, 65)}`;
  if (group === 1) {
    const tower = slug.includes('tower');
    const circle = slug.includes('orbit') || slug.includes('smart');
    return `${circle ? '<circle cx="500" cy="420" r="210" fill="url(#product)"/>' : `<rect x="${tower ? 360 : 285}" y="${tower ? 130 : 235}" width="${tower ? 280 : 430}" height="${tower ? 500 : 360}" rx="${tower ? 25 : 68}" ${product}/>`}${rear ? '<rect x="455" y="380" width="90" height="145" rx="16" fill="#17212A"/><circle cx="480" cy="410" r="10" fill="url(#metal)"/><circle cx="520" cy="410" r="10" fill="url(#metal)"/>' : speaker(500, tower ? 465 : 410, tower ? 85 : 135)}${tower && !rear ? speaker(500, 270, 65) : ''}${/outdoor|field/.test(slug) ? '<path d="M370 248V205h260v43" fill="none" stroke="#17212A" stroke-width="18"/>' : ''}`;
  }
  if (slug === 'travel-tripod')
    return `<rect x="430" y="240" width="140" height="60" rx="15" ${product}/><circle cx="500" cy="330" r="38" fill="url(#metal)"/><path d="M500 365L285 610m215-245 215 245m-215-245v275" fill="none" stroke="url(#product)" stroke-width="28" stroke-linecap="round"/>`;
  if (slug === 'camera-lens')
    return `<rect x="355" y="270" width="290" height="300" rx="70" ${product}/><ellipse cx="500" cy="285" rx="145" ry="70" fill="#17212A"/><ellipse cx="500" cy="285" rx="90" ry="43" fill="url(#metal)"/><path d="M365 390h270m-270 28h270m-270 28h270" stroke="#17212A" stroke-width="8" opacity=".5"/>`;
  if (slug === 'camera-bag')
    return `<path d="M300 300q200-80 400 0l35 270H265z" ${product}/><rect x="345" y="380" width="310" height="170" rx="35" fill="#17212A" opacity=".45"/><path d="M330 310q170-190 340 0" fill="none" stroke="#17212A" stroke-width="22"/>`;
  if (/gimbal/.test(slug))
    return `<rect x="455" y="390" width="90" height="220" rx="28" ${product}/><path d="M500 405V290h145v-90H380v90" fill="none" ${metal} stroke-width="25"/><rect x="435" y="220" width="130" height="80" rx="15" ${product}/>`;
  if (/video-light|webcam|action-camera/.test(slug))
    return `<rect x="320" y="285" width="360" height="240" rx="35" ${product}/>${rear ? '<rect x="395" y="350" width="210" height="105" rx="12" fill="#17212A"/>' : slug.includes('light') ? '<rect x="345" y="310" width="310" height="190" rx="18" fill="#ECE7DA"/>' : speaker(500, 405, 70)}<path d="M455 525v55h90v-55" fill="url(#metal)"/>`;
  if (group === 2)
    return `<rect x="265" y="275" width="470" height="325" rx="${slug.includes('instant') ? 65 : 42}" ${product}/><path d="M325 275v-55h105v55" fill="url(#metal)"/>${rear ? '<rect x="345" y="335" width="285" height="195" rx="15" fill="#17212A"/><g fill="url(#metal)"><circle cx="680" cy="370" r="12"/><circle cx="680" cy="420" r="12"/></g>' : speaker(500, 438, 118)}`;
  if (/desk-lamp|display-light/.test(slug))
    return `<ellipse cx="500" cy="590" rx="165" ry="35" ${product}/><path d="M500 565v-155l145-145" fill="none" ${metal} stroke-width="24" stroke-linecap="round"/><path d="M530 245h230l-20 55H550z" ${product}/><path d="M550 300h185" stroke="#ECE7DA" stroke-width="8"/>`;
  if (/mouse/.test(slug))
    return `<path d="M380 505V325q120-110 240 0v180q-120 100-240 0" ${product}/><path d="M500 310v145" stroke="#17212A" stroke-width="5"/><rect x="488" y="325" width="24" height="64" rx="12" fill="url(#metal)"/>`;
  if (/stand|monitor-arm/.test(slug))
    return `<path d="M300 310h400l55 80H245z" ${product}/><path d="M345 380l-45 170h65l60-170m230 0 45 170h-65l-60-170" fill="url(#metal)"/>${slug.includes('arm') ? '<path d="M500 350v-90l145-75" fill="none" stroke="#17212A" stroke-width="30"/>' : ''}`;
  if (/microphone/.test(slug))
    return `<ellipse cx="500" cy="610" rx="145" ry="28" ${product}/><path d="M500 590V490" ${metal} stroke-width="20"/><rect x="420" y="200" width="160" height="310" rx="80" ${product}/><path d="M395 345v95q105 145 210 0v-95" fill="none" ${metal} stroke-width="15"/><path d="M448 260h104m-104 24h104m-104 24h104" stroke="#17212A" stroke-width="6"/>`;
  if (/desk-mat/.test(slug))
    return '<path d="M190 320h620l65 240H125z" fill="url(#product)"/><path d="M210 340h580l45 195H165z" fill="none" stroke="url(#metal)" stroke-width="2" opacity=".5"/>';
  if (group === 3)
    return `<path d="M230 290h540l65 270H165z" ${product}/><g fill="#E7E5DD" opacity=".7">${Array.from({ length: 40 }, (_, i) => `<rect x="${250 + (i % 10) * 51}" y="${325 + Math.floor(i / 10) * 47}" width="40" height="34" rx="7"/>`).join('')}</g>${rear ? '<rect x="380" y="530" width="240" height="15" rx="6" fill="#17212A"/>' : ''}`;
  if (/cable/.test(slug))
    return `<ellipse cx="500" cy="430" rx="190" ry="135" fill="none" stroke="url(#product)" stroke-width="28"/><path d="M365 335l-60-100m-10 0h35v-70h-35m340 360 60 55m-10 0h40v55h-40" fill="none" ${metal} stroke-width="18"/>`;
  if (/solar/.test(slug))
    return `<path d="M230 260h540l65 330H165z" ${product}/><g fill="#17212A">${Array.from({ length: 12 }, (_, i) => `<rect x="${260 + (i % 4) * 120}" y="${300 + Math.floor(i / 4) * 85}" width="102" height="70" rx="8"/>`).join('')}</g>`;
  if (/dock|charger|charging/.test(slug))
    return `<ellipse cx="500" cy="565" rx="220" ry="45" ${product}/><path d="M450 555V390l130-70" fill="none" ${metal} stroke-width="35"/><ellipse cx="595" cy="315" rx="100" ry="75" ${product}/><ellipse cx="595" cy="315" rx="55" ry="40" fill="none" ${metal} stroke-width="9"/>${detail}`;
  return `<rect x="295" y="260" width="410" height="340" rx="45" ${product}/><path d="M380 260v-70h240v70" fill="none" ${metal} stroke-width="22"/><rect x="340" y="325" width="185" height="100" rx="15" fill="#17212A"/><circle cx="600" cy="410" r="35" fill="url(#metal)"/>${detail}`;
}
