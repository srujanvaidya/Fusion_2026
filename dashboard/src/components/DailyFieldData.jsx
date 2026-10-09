import React, { useMemo, useState, useEffect } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Glyph from './icons/Glyph';
import { askRayaLLM } from '../services/rayaLLM';

const HEAT = 36; // deg C at which most field crops start to suffer
const r1 = (v) => Math.round(v * 10) / 10;

/** NDVI is measured every ~10 days; estimate each day by interpolating between passes. */
function ndviOnDay(series, daysAgo) {
  const pos = series.length - 1 - daysAgo / 10;
  if (pos < 0) return null;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  const t = pos - lo;
  return series[lo].ndvi * (1 - t) + series[hi].ndvi * t;
}

const fmtDay = (iso, mr) => new Date(iso + 'T00:00:00').toLocaleDateString(mr ? 'mr-IN' : 'en-IN', { day: '2-digit', month: 'short' });
const fmtWeekday = (iso, mr) => new Date(iso + 'T00:00:00').toLocaleDateString(mr ? 'mr-IN' : 'en-IN', { weekday: 'short' });

export default function DailyFieldData({ theme, lang, field, analysis: a, weather, crop }) {
  const mr = lang === 'mr';
  const L = (en, m) => (mr ? m : en);
  const [ai, setAi] = useState({ key: '', text: '', loading: false, failed: false });

  const rows = useMemo(() => {
    if (!weather?.days) return [];
    const todayIdx = weather.days.findIndex((d) => d.today);
    return weather.days.map((d, i) => {
      const daysAgo = todayIdx - i;
      return {
        ...d,
        balance: r1(d.rain - d.et0),
        ndvi: daysAgo >= 0 ? ndviOnDay(a.series, daysAgo) : null,
        label: fmtDay(d.date, mr),
        wk: fmtWeekday(d.date, mr),
        soilPct: d.soil != null ? Math.round(d.soil * 100) : null,
      };
    });
  }, [weather, a, mr]);

  const past = rows.filter((r) => !r.future);

  // insights computed from the real daily series
  const insights = useMemo(() => {
    if (past.length < 5) return [];
    const out = [];
    const rain = past.reduce((s, r) => s + r.rain, 0);
    const wet = past.filter((r) => r.rain >= 1).length;
    let dry = 0;
    for (let i = past.length - 1; i >= 0 && past[i].rain < 1; i--) dry++;
    const demand = past.reduce((s, r) => s + r.et0, 0);
    const deficit = demand - rain;
    const hot = past.filter((r) => r.tmax >= HEAT);
    const hottest = past.reduce((m, r) => (r.tmax > m.tmax ? r : m), past[0]);
    const soilVals = past.filter((r) => r.soilPct != null);
    const nd0 = past[0].ndvi, nd1 = past[past.length - 1].ndvi;
    const week = past.slice(-7);
    const ndWeekDrop = week[0].ndvi != null && week[week.length - 1].ndvi != null ? week[0].ndvi - week[week.length - 1].ndvi : null;

    out.push({
      tone: dry >= 5 || rain < 15 ? 'bad' : wet >= 6 ? 'good' : 'warn',
      icon: 'cloudrain',
      title: L('Rainfall', 'पाऊस'),
      text: L(`${r1(rain)} mm over ${past.length} days on ${wet} rainy day${wet === 1 ? '' : 's'}. ${dry >= 3 ? `It has been dry for ${dry} days in a row.` : 'No long dry spell right now.'}`,
        `${past.length} दिवसांत ${r1(rain)} मिमी, ${wet} दिवस पाऊस. ${dry >= 3 ? `सलग ${dry} दिवस कोरडे आहेत.` : 'सध्या मोठा कोरडा काळ नाही.'}`),
    });
    out.push({
      tone: deficit > 40 ? 'bad' : deficit > 15 ? 'warn' : 'good',
      icon: 'drop',
      title: L('Water balance', 'पाण्याचा ताळमेळ'),
      text: deficit > 0
        ? L(`${crop} used about ${Math.round(demand)} mm but only ${r1(rain)} mm fell, a shortfall of ${Math.round(deficit)} mm that irrigation or soil reserves had to cover.`, `${crop} ला सुमारे ${Math.round(demand)} मिमी लागले पण फक्त ${r1(rain)} मिमी पडला, ${Math.round(deficit)} मिमी तूट सिंचन/जमिनीतील साठ्याने भागवावी लागली.`)
        : L(`Rain (${r1(rain)} mm) covered crop water use (${Math.round(demand)} mm). No water shortfall.`, `पाऊस (${r1(rain)} मिमी) पिकाच्या पाणी वापराएवढा (${Math.round(demand)} मिमी) होता. पाण्याची तूट नाही.`),
    });
    out.push({
      tone: hot.length >= 4 ? 'bad' : hot.length ? 'warn' : 'good',
      icon: 'sun',
      title: L('Heat', 'उष्णता'),
      text: hot.length
        ? L(`${hot.length} day${hot.length > 1 ? 's' : ''} reached ${HEAT}°C or more. Hottest was ${Math.round(hottest.tmax)}°C on ${hottest.label}.`, `${hot.length} दिवस तापमान ${HEAT}°C किंवा जास्त होते. सर्वात जास्त ${Math.round(hottest.tmax)}°C, ${hottest.label} रोजी.`)
        : L(`No heat stress days. The peak was ${Math.round(hottest.tmax)}°C on ${hottest.label}.`, `उष्णतेचा ताण नाही. कमाल ${Math.round(hottest.tmax)}°C, ${hottest.label} रोजी.`),
    });
    if (soilVals.length > 4) {
      const s0 = soilVals[0].soilPct, s1 = soilVals[soilVals.length - 1].soilPct;
      out.push({
        tone: s1 < 18 ? 'bad' : s1 < s0 - 4 ? 'warn' : 'good',
        icon: 'chart',
        title: L('Soil moisture', 'जमिनीतील ओलावा'),
        text: L(`Top-soil moisture went from ${s0}% to ${s1}% (${s1 - s0 >= 0 ? '+' : ''}${s1 - s0} points). ${s1 < 18 ? 'The top layer is dry.' : s1 < s0 - 4 ? 'It is drying out.' : 'It is holding up.'}`,
          `वरच्या थरातील ओलावा ${s0}% वरून ${s1}% झाला (${s1 - s0 >= 0 ? '+' : ''}${s1 - s0}). ${s1 < 18 ? 'वरचा थर कोरडा आहे.' : s1 < s0 - 4 ? 'ओलावा कमी होत आहे.' : 'ओलावा टिकून आहे.'}`),
      });
    }
    if (nd0 != null && nd1 != null) {
      out.push({
        tone: a.level === 'critical' ? 'bad' : a.level === 'healthy' ? 'good' : 'warn',
        icon: 'sprout',
        title: L('Crop health (NDVI)', 'पीक आरोग्य (NDVI)'),
        text: L(`Estimated NDVI moved from ${nd0.toFixed(2)} to ${nd1.toFixed(2)}${ndWeekDrop != null ? `, ${ndWeekDrop > 0.01 ? `down ${ndWeekDrop.toFixed(2)} in the last 7 days` : ndWeekDrop < -0.01 ? `up ${Math.abs(ndWeekDrop).toFixed(2)} in the last 7 days` : 'flat over the last 7 days'}` : ''}. ${a.level === 'healthy' ? 'Tracking its normal curve.' : `${deficit > 15 && hot.length ? 'Dry, hot weather lines up with this decline.' : deficit > 15 ? 'Low rain lines up with this decline.' : 'Weather alone does not explain it, so check for pests or disease.'}`}`,
          `अंदाजित NDVI ${nd0.toFixed(2)} वरून ${nd1.toFixed(2)} झाला${ndWeekDrop != null ? `, ${ndWeekDrop > 0.01 ? `गेल्या ७ दिवसांत ${ndWeekDrop.toFixed(2)} ने घट` : ndWeekDrop < -0.01 ? `गेल्या ७ दिवसांत ${Math.abs(ndWeekDrop).toFixed(2)} ने वाढ` : 'गेल्या ७ दिवसांत स्थिर'}` : ''}. ${a.level === 'healthy' ? 'सामान्य वक्रानुसार आहे.' : `${deficit > 15 && hot.length ? 'कोरडे व उष्ण हवामान या घटीशी जुळते.' : deficit > 15 ? 'कमी पाऊस या घटीशी जुळतो.' : 'हवामान एकटे कारण नाही, कीड/रोग तपासा.'}`}`),
      });
    }
    return out;
  }, [past, a, crop, mr]); // eslint-disable-line react-hooks/exhaustive-deps

  // ask the AI to read the table (falls back to a note if the model is not available)
  const aiKey = `${field.firestoreId || field.id || field.gutNo || field.gatNumber}-${lang}-${rows.length}`;
  useEffect(() => { setAi({ key: '', text: '', loading: false, failed: false }); }, [aiKey]);
  const explain = async () => {
    setAi({ key: aiKey, text: '', loading: true, failed: false });
    const context = {
      today: new Date().toISOString().slice(0, 10),
      fields: [{ focus: true, crop, plotNo: field.gatNumber || field.gutNo, village: field.village, district: field.district, areaHa: parseFloat(field.area) || null, ndvi: { current: a.ndvi, normalForThisStage: a.baseline, deviationSigma: a.z, level: a.level, likelyCause: a.cause } }],
      dailyData: rows.map((r) => ({ date: r.date, forecast: r.future, maxC: Math.round(r.tmax), minC: Math.round(r.tmin), rainMm: r1(r.rain), cropWaterUseMm: r1(r.et0), soilMoisturePct: r.soilPct, estimatedNdvi: r.ndvi != null ? +r.ndvi.toFixed(2) : null })),
    };
    const text = await askRayaLLM({
      message: 'Read the dailyData for this field. In 4 short points: what stands out, how it relates to the NDVI and crop health, and exactly what to do over the next 3 days. Use the real numbers.',
      history: [], context, lang,
    });
    setAi({ key: aiKey, text: text || '', loading: false, failed: !text });
  };

  const toneColor = { good: '#22c55e', warn: '#f59e0b', bad: '#ef4444' };
  const chartData = rows.map((r) => ({ label: r.label, rain: r1(r.rain), tmax: Math.round(r.tmax), soil: r.soilPct }));
  const th = { textAlign: 'left', padding: '10px 12px', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 600, whiteSpace: 'nowrap', borderBottom: `1px solid ${theme.border}` };
  const td = { padding: '11px 12px', fontSize: 13, whiteSpace: 'nowrap', borderBottom: `1px solid ${theme.border}` };

  return (
    <section style={{ background: theme.card, borderRadius: 24, border: `1px solid ${theme.border}`, boxShadow: theme.shadow, padding: 24, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 500, margin: 0 }}>{L('Daily data and insights', 'दैनिक माहिती व निरीक्षणे')}</h2>
          <div style={{ fontSize: 12, color: theme.textDim, marginTop: 4 }}>{L('Last 14 days plus a 2-day forecast. Weather and soil are measured; NDVI is estimated between satellite passes.', 'गेले १४ दिवस व २ दिवसांचा अंदाज. हवामान व माती मोजलेली; NDVI उपग्रह नोंदींमधील अंदाजित.')}</div>
        </div>
        <button onClick={explain} disabled={!rows.length || ai.loading} style={{ background: theme.text, color: theme.bg, border: 'none', borderRadius: 30, padding: '10px 18px', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Glyph name="info" size={15} /> {ai.loading ? L('Reading the data...', 'माहिती वाचत आहे...') : L('Explain this data', 'ही माहिती समजावा')}
        </button>
      </div>

      {!rows.length ? (
        <div style={{ fontSize: 13, color: theme.textDim }}>{L('Loading daily data...', 'दैनिक माहिती लोड होत आहे...')}</div>
      ) : (
        <>
          {(ai.text || ai.failed) && (
            <div style={{ marginBottom: 18, padding: '16px 18px', borderRadius: 18, background: theme.accentBg, border: `1px solid ${theme.accentBorder}` }}>
              <div style={{ fontSize: 10, letterSpacing: '.07em', textTransform: 'uppercase', color: theme.textDim, fontWeight: 700, marginBottom: 8 }}>{L('AI reading of this field', 'या शेताचे AI विश्लेषण')}</div>
              <div style={{ fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                {ai.text || L('The AI assistant is not available right now. The insights below are computed directly from the data.', 'AI सहाय्यक सध्या उपलब्ध नाही. खालील निरीक्षणे थेट माहितीवरून काढली आहेत.')}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12, marginBottom: 22 }}>
            {insights.map((i) => (
              <div key={i.title} style={{ padding: '16px 18px', borderRadius: 18, background: `${toneColor[i.tone]}10`, border: `1px solid ${toneColor[i.tone]}33` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: toneColor[i.tone], marginBottom: 8 }}>
                  <Glyph name={i.icon} size={16} /><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{i.title}</span>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>{i.text}</div>
              </div>
            ))}
          </div>

          <div style={{ width: '100%', height: 220, marginBottom: 6 }}>
            <ResponsiveContainer>
              <ComposedChart data={chartData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: theme.textDim }} axisLine={false} tickLine={false} interval={1} />
                <YAxis yAxisId="t" tick={{ fontSize: 10, fill: theme.textDim }} axisLine={false} tickLine={false} domain={['dataMin - 3', 'dataMax + 3']} />
                <YAxis yAxisId="r" orientation="right" hide domain={[0, 'dataMax + 10']} />
                <YAxis yAxisId="s" orientation="right" hide domain={[0, 60]} />
                <Tooltip contentStyle={{ background: theme.cardAlt, border: `1px solid ${theme.border}`, borderRadius: 12, fontSize: 12 }} />
                <Bar yAxisId="r" dataKey="rain" name={L('Rain (mm)', 'पाऊस (मिमी)')} fill="#60a5fa" fillOpacity={0.55} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Line yAxisId="t" dataKey="tmax" name={L('Max temp (°C)', 'कमाल तापमान')} stroke="#f97316" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Line yAxisId="s" dataKey="soil" name={L('Soil moisture (%)', 'ओलावा (%)')} stroke="#22c55e" strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 11, color: theme.textDim, marginBottom: 20 }}>
            <span><b style={{ color: '#60a5fa' }}>■</b> {L('Rain', 'पाऊस')}</span>
            <span><b style={{ color: '#f97316' }}>━</b> {L('Max temperature', 'कमाल तापमान')}</span>
            <span><b style={{ color: '#22c55e' }}>┅</b> {L('Soil moisture', 'जमिनीतील ओलावा')}</span>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: 16, border: `1px solid ${theme.border}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr>
                  {[L('Date', 'दिनांक'), L('Temp', 'तापमान'), L('Rain', 'पाऊस'), L('Crop water use', 'पाणी वापर'), L('Balance', 'ताळमेळ'), L('Soil', 'माती'), L('NDVI (est.)', 'NDVI (अंदाज)'), ''].map((h, i) => <th key={i} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((r) => (
                  <tr key={r.date} style={{ background: r.today ? theme.accentBg : 'transparent', opacity: r.future ? 0.7 : 1 }}>
                    <td style={td}><b>{r.label}</b> <span style={{ color: theme.textMuted, fontSize: 11 }}>{r.wk}</span></td>
                    <td style={{ ...td, color: r.tmax >= HEAT ? '#ef4444' : theme.text }}>{Math.round(r.tmax)}° / {Math.round(r.tmin)}°</td>
                    <td style={{ ...td, color: r.rain >= 1 ? '#60a5fa' : theme.textMuted }}>{r1(r.rain)} mm</td>
                    <td style={td}>{r1(r.et0)} mm</td>
                    <td style={{ ...td, color: r.balance < -3 ? '#f59e0b' : '#22c55e' }}>{r.balance > 0 ? '+' : ''}{r.balance}</td>
                    <td style={td}>{r.soilPct != null ? `${r.soilPct}%` : '-'}</td>
                    <td style={td}>{r.ndvi != null ? r.ndvi.toFixed(2) : '-'}</td>
                    <td style={td}>
                      {r.today && <span style={{ fontSize: 10, fontWeight: 700, color: theme.text }}>{L('TODAY', 'आज')}</span>}
                      {r.future && <span style={{ fontSize: 10, color: theme.textMuted }}>{L('FORECAST', 'अंदाज')}</span>}
                      {!r.future && !r.today && r.tmax >= HEAT && <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 700 }}>{L('HEAT', 'उष्णता')}</span>}
                      {!r.future && !r.today && r.tmax < HEAT && r.rain >= 10 && <span style={{ fontSize: 10, color: '#60a5fa', fontWeight: 700 }}>{L('HEAVY RAIN', 'जोरदार पाऊस')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 10 }}>{L('Balance = rain minus crop water use, in mm. Negative means the crop used more water than rain supplied.', 'ताळमेळ = पाऊस वजा पिकाचा पाणी वापर (मिमी). उणे म्हणजे पावसापेक्षा जास्त पाणी वापरले गेले.')}</div>
        </>
      )}
    </section>
  );
}
