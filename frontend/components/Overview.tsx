'use client';

import { useReveal } from '@/lib/useReveal';
import styles from '@/app/overview.module.css';

interface Props {
  onNavigate: (view: 'record') => void;
}

function Step({ num, title, body, art }: {
  num: string; title: string; body: string; art: React.ReactNode;
}) {
  const { ref, visible } = useReveal<HTMLElement>(0.3);
  return (
    <article ref={ref} className={styles.step} data-visible={visible}>
      <span className={styles.stepNum}>{num}</span>
      <svg viewBox="0 0 200 150" className={styles.stepArt} aria-hidden="true">{art}</svg>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

function KitItem({ art, name, mount }: { art: React.ReactNode; name: string; mount: string }) {
  const { ref, visible } = useReveal<HTMLElement>(0.25);
  return (
    <figure ref={ref} className={styles.kitItem} data-visible={visible}>
      <svg viewBox="0 0 120 260" aria-hidden="true">{art}</svg>
      <figcaption>{name}<span>{mount}</span></figcaption>
    </figure>
  );
}

export default function Overview({ onNavigate }: Props) {
  const dovetail = useReveal<HTMLDivElement>(0.3);
  const cta = useReveal<HTMLDivElement>(0.3);

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <svg className={styles.heroArc} viewBox="0 0 900 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path d="M120,380 C160,120 480,40 780,150" fill="none" stroke="rgba(214,230,75,0.12)" strokeWidth="2" />
          <path d="M120,380 C160,120 480,40 780,150" fill="none" stroke="#D6E64B" strokeWidth="2.5"
                strokeLinecap="round" strokeDasharray="900" strokeDashoffset="900">
            <animate attributeName="stroke-dashoffset" from="900" to="0" dur="2.4s"
                     begin="0.4s" fill="freeze" calcMode="spline" keySplines="0.3 0 0.2 1" keyTimes="0;1" />
          </path>
          <g>
            <animateMotion dur="2.4s" begin="0.4s" fill="freeze" rotate="auto"
                           path="M120,380 C160,120 480,40 780,150" calcMode="spline"
                           keySplines="0.3 0 0.2 1" keyTimes="0;1" />
            <line x1="0" y1="0" x2="0" y2="70" stroke="#EFF3EC" strokeWidth="3" strokeLinecap="round" />
            <line x1="0" y1="0" x2="0" y2="20" stroke="#8FA69D" strokeWidth="7" strokeLinecap="round" />
            <path d="M-3,70 L20,76 L18,86 L-3,82 Z" fill="#EFF3EC" />
            <rect x="-7" y="4" width="14" height="11" rx="2" fill="#D6E64B" />
          </g>
        </svg>

        <div className={styles.heroCopy}>
          <span className={styles.kicker}>Modular sports motion capture</span>
          <h1 className={styles.heroTitle}>Every swing,<br /><em>measured.</em></h1>
          <p className={styles.heroLede}>
            One sensing unit, any sport. A six-axis IMU samples your movement two
            hundred times a second, then tells you what you did and how repeatably
            you did it.
          </p>
          <div className={styles.heroStats}>
            <div><b>200</b><span>samples / sec</span></div>
            <div><b>&plusmn;2000</b><span>&deg;/s range</span></div>
            <div><b>&lt;&euro;30</b><span>parts cost</span></div>
          </div>
          <div className={styles.heroCta}>
            <button className="btn btnGo" onClick={() => onNavigate('record')}>Start recording</button>
          </div>
        </div>
      </section>

      <section className={styles.chapter}>
        <span className={styles.chapterEyebrow}>How it reads a swing</span>
        <h2 className={styles.chapterTitle}>Motion becomes meaning<br />in three steps.</h2>

        <div className={styles.steps}>
          <Step
            num="01" title="The swing happens"
            body="The unit rides on the racket handle or your wrist, logging acceleration and rotation through the whole stroke."
            art={<>
              <path className={styles.drawPath} d="M30,130 C40,50 140,25 175,70" fill="none"
                    stroke="#D6E64B" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="175" cy="70" r="5" fill="#D6E64B" />
              <rect x="24" y="124" width="13" height="10" rx="2" fill="#EFF3EC" />
            </>}
          />
          <Step
            num="02" title="It becomes a signal"
            body="Raw angular velocity streams over WiFi. Peaks above the threshold mark where one repetition starts and ends."
            art={<>
              <line x1="15" y1="115" x2="185" y2="115" stroke="#2C554A" strokeWidth="1" />
              <path className={styles.drawPath}
                    d="M15,112 L45,110 L58,108 L70,40 L80,118 L92,105 L110,112 L128,109 L140,48 L150,116 L162,110 L185,112"
                    fill="none" stroke="#D6E64B" strokeWidth="2" strokeLinejoin="round" />
              <line x1="15" y1="72" x2="185" y2="72" stroke="#DE7040" strokeWidth="1" strokeDasharray="4 4" />
            </>}
          />
          <Step
            num="03" title="The model names it"
            body="Forty-two features per repetition feed a Random Forest that identifies the stroke and scores how consistent it was."
            art={<>
              <rect x="26" y="42" width="148" height="30" rx="3" fill="rgba(214,230,75,0.12)" stroke="#D6E64B" strokeWidth="1" />
              <text x="40" y="63" fill="#D6E64B" fontFamily="JetBrains Mono, monospace" fontSize="15">forehand</text>
              <text x="138" y="63" fill="#8FA69D" fontFamily="JetBrains Mono, monospace" fontSize="13">94%</text>
              <rect x="26" y="84" width="98" height="7" rx="3" fill="#D6E64B" opacity="0.75" />
              <rect x="26" y="99" width="62" height="7" rx="3" fill="#8FA69D" opacity="0.5" />
              <rect x="26" y="114" width="34" height="7" rx="3" fill="#8FA69D" opacity="0.3" />
            </>}
          />
        </div>
      </section>

      <section className={styles.chapter}>
        <span className={styles.chapterEyebrow}>One unit, many sports</span>
        <h2 className={styles.chapterTitle}>The same sensor,<br />a different mount.</h2>
        <p className={styles.chapterLede}>
          Commercial swing sensors lock you into a single sport and a single app.
          This one clips to whatever you already own.
        </p>

        <div className={styles.kitRow}>
          <KitItem name="Racket" mount="saddle mount, zip-tied" art={<>
            <ellipse cx="60" cy="78" rx="41" ry="56" fill="none" stroke="#EFF3EC" strokeWidth="3" />
            <g stroke="rgba(143,166,157,0.4)" strokeWidth="1">
              <line x1="34" y1="30" x2="34" y2="126" /><line x1="47" y1="24" x2="47" y2="132" />
              <line x1="60" y1="22" x2="60" y2="134" /><line x1="73" y1="24" x2="73" y2="132" />
              <line x1="86" y1="30" x2="86" y2="126" />
              <line x1="22" y1="55" x2="98" y2="55" /><line x1="20" y1="78" x2="100" y2="78" />
              <line x1="22" y1="101" x2="98" y2="101" />
            </g>
            <path d="M45,130 L52,175 M75,130 L68,175" stroke="#EFF3EC" strokeWidth="3" fill="none" />
            <rect x="52" y="172" width="16" height="62" rx="4" fill="#EFF3EC" />
            <rect className={styles.mountFlash} x="46" y="222" width="28" height="20" rx="3" fill="#D6E64B" />
          </>} />

          <KitItem name="Golf club" mount="grip-end mount" art={<>
            <line x1="60" y1="34" x2="46" y2="210" stroke="#EFF3EC" strokeWidth="3" strokeLinecap="round" />
            <line x1="60" y1="34" x2="55" y2="96" stroke="#8FA69D" strokeWidth="9" strokeLinecap="round" />
            <path d="M42,208 L84,222 L80,242 L40,228 Z" fill="#EFF3EC" />
            <rect className={styles.mountFlash} x="47" y="36" width="26" height="19" rx="3" fill="#D6E64B" />
          </>} />

          <KitItem name="Bat" mount="handle mount" art={<>
            <path d="M52,214 L52,150 Q52,118 44,70 Q40,32 60,26 Q80,32 76,70 Q68,118 68,150 L68,214 Z"
                  fill="none" stroke="#EFF3EC" strokeWidth="3" strokeLinejoin="round" />
            <line x1="52" y1="196" x2="68" y2="196" stroke="#8FA69D" strokeWidth="2" />
            <rect className={styles.mountFlash} x="46" y="214" width="28" height="20" rx="3" fill="#D6E64B" />
          </>} />

          <KitItem name="Wrist" mount="strap plate" art={<>
            <ellipse cx="60" cy="150" rx="46" ry="34" fill="none" stroke="#EFF3EC" strokeWidth="3" />
            <path d="M22,132 Q60,112 98,132" fill="none" stroke="#8FA69D" strokeWidth="2" />
            <path d="M22,168 Q60,188 98,168" fill="none" stroke="#8FA69D" strokeWidth="2" />
            <rect className={styles.mountFlash} x="46" y="98" width="28" height="20" rx="3" fill="#D6E64B" />
          </>} />
        </div>

        <div ref={dovetail.ref} className={styles.dovetailNote} data-visible={dovetail.visible}>
          <div className={styles.dtSvg}>
            <svg viewBox="0 0 240 120" aria-hidden="true">
              <rect x="40" y="14" width="160" height="34" rx="4" fill="#194037" stroke="#2C554A" />
              <path d="M104,48 L136,48 L142,66 L98,66 Z" fill="#194037" stroke="#2C554A" />
              <path className={styles.slideAnim} d="M100,70 L140,70 L146,88 L94,88 Z" fill="#D6E64B" opacity="0.9" />
              <rect x="40" y="88" width="160" height="20" rx="3" fill="#2C554A" />
            </svg>
          </div>
          <div>
            <h3>A dovetail does the work</h3>
            <p>Every mount carries the same flared rail. The case slides on, hits a
              stop, and cannot lift off &mdash; swap sports in about five seconds.</p>
          </div>
        </div>
      </section>

      <section ref={cta.ref} className={styles.ctaBand} data-visible={cta.visible}>
        <h2>Ready when you are.</h2>
        <p>Power the sensor, name the motion, and swing.</p>
        <button className="btn btnGo" onClick={() => onNavigate('record')}>Go to recording</button>
      </section>
    </>
  );
}
