import { useState } from 'react'

export default function GiveBack() {
  const [mode, setMode] = useState('flat')
  const [amount, setAmount] = useState('')
  const [percent, setPercent] = useState('')
  const [pledged, setPledged] = useState(false)
  const value = mode === 'flat' ? amount : percent
  return (
    <section className="settings-giveback" aria-label="Diaita Group Initiative">
      <div className="settings-giveback-head">
        <h3 className="settings-giveback-title">Diaita Group Initiative</h3>
      </div>
      <div className="settings-pledge-modes" role="group" aria-label="Pledge type">
        {[['flat', '$', 'flat / month'], ['percent', '%', 'of earnings']].map(([id, symbol, label]) => (
          <div className={`settings-pledge-mode is-input ${mode === id ? 'is-active' : ''}`} key={id} onClick={() => { setMode(id); setPledged(false) }}>
            <label className="settings-pledge-pct">
              {id === 'flat' && <span className="settings-pledge-pct-suffix" aria-hidden>{symbol}</span>}
              <input
                className="settings-pledge-pct-input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                aria-label={id === 'flat' ? 'Pledge dollars per month' : 'Pledge percent of earnings'}
                value={id === 'flat' ? amount : percent}
                onFocus={() => { setMode(id); setPledged(false) }}
                onChange={(event) => {
                  const next = event.target.value.replace(/\D/g, '').slice(0, id === 'flat' ? 4 : 3)
                  if (id === 'flat') setAmount(next)
                  else setPercent(next)
                  setMode(id)
                  setPledged(false)
                }}
              />
              {id === 'percent' && <span className="settings-pledge-pct-suffix" aria-hidden>{symbol}</span>}
            </label>
            <span className="settings-pledge-small">{label}</span>
          </div>
        ))}
      </div>
      <button type="button" className={`settings-pledge-cta ${pledged ? 'is-on' : ''}`} disabled={!value || Number(value) <= 0} onClick={() => setPledged(!pledged)}>
        {pledged ? 'PLEDGED' : 'PLEDGE'} {mode === 'flat' ? `$${amount} / MONTH` : `${percent}% OF EARNINGS`}
      </button>
    </section>
  )
}
