import { useRef } from 'react';
import useSectionMotion from '../../hooks/useSectionMotion';
import './Footer.css';

const KO_FI_URL = 'https://ko-fi.com/leotorol';
const REPO_URL = 'https://github.com/leotorol/Letterboxd_Profile_Analyzer';
const LETTERBOXD_URL = 'https://letterboxd.com/leotorol/';
const EMAIL = 'leotorolr2@gmail.com';
const BUG_SUBJECT = 'Letterboxd Stats bug report';
const GMAIL_COMPOSE_URL = `https://mail.google.com/mail/?view=cm&fs=1&to=${EMAIL}&su=${encodeURIComponent(BUG_SUBJECT)}`;

/*
 * Footer contract
 * THESIS: the house lights come back up after the section 09 blackout. The
 *   report ends, the credits roll and the page hands you the exits.
 * OWN WORLD: same star field as the rest of the page, one warm card for the
 *   tip jar and the Letterboxd three dot mark as the closing signature.
 * STORY: thanks for scrolling, here is the source, here is the profile, here
 *   is where to complain when your ZIP behaves weird.
 */

const CoffeeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z" />
    <path d="M16 10h2a2 2 0 0 1 0 4h-2" />
    <path d="M7 3v2.4M11 3v2.4" />
  </svg>
);

const GithubIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);

const ArrowIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="5" y1="19" x2="19" y2="5" />
    <polyline points="9 5 19 5 19 15" />
  </svg>
);

const LetterboxdMark = () => (
  <span className="ft-lb-mark" aria-hidden="true">
    <span className="is-orange" />
    <span className="is-green" />
    <span className="is-blue" />
  </span>
);

const LINK_ROWS = [
  {
    label: 'Source',
    title: 'Letterboxd Profile Analyzer',
    text: 'The whole thing is open source on GitHub.',
    href: REPO_URL,
    icon: GithubIcon,
  },
  {
    label: 'Follow',
    title: 'leotorol on Letterboxd',
    text: 'See what I am watching and what I rate way too high. (Reviews are in spanish tho)',
    href: LETTERBOXD_URL,
    icon: LetterboxdMark,
  },
];

/**
 * Renders the closing credits after the A to Z game.
 *
 * The footer picks up the black wash where section 09 drops it and fades back
 * into the star field, so the game stage and the credits never meet on a seam.
 *
 * Returns:
 *   JSX.Element: The footer.
 */
export default function Footer() {
  const footerRef = useRef(null);
  useSectionMotion(footerRef);

  return (
    <footer className="ft" id="credits" data-section ref={footerRef}>
      <div className="ft-inner">
        <div className="ft-rule" aria-hidden="true" />

        <header className="ft-head" data-reveal>
          <span className="ft-kicker">End credits</span>
          <h2 className="ft-title">
            That is a wrap
          </h2>
          <p className="ft-sub">
            Nine chapters, every film you have ever logged.<br />
            Thanks for scrolling all the way to the credits.
          </p>
        </header>

        <div className="ft-links" data-reveal>
          <a
            className="ft-support"
            href={KO_FI_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="ft-support-top">
              <span className="ft-icon"><CoffeeIcon /></span>
              <ArrowIcon />
            </div>
            <div className="ft-support-copy">
              <span className="ft-label">Support the project</span>
              <span className="ft-support-title">Buy me a coffee</span>
              <span className="ft-support-text">
                If this made your log look good, you can keep the projector running.
              </span>
              <span className="ft-support-meta">ko-fi.com/leotorol</span>
            </div>
          </a>

          <div className="ft-rows">
            {LINK_ROWS.map(({ label, title, text, href, icon: Icon }) => (
              <a
                key={href}
                className="ft-row"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="ft-icon"><Icon /></span>
                <span className="ft-row-copy">
                  <span className="ft-label">{label}</span>
                  <span className="ft-row-title">{title}</span>
                  <span className="ft-row-text">{text}</span>
                </span>
                <ArrowIcon />
              </a>
            ))}
          </div>
        </div>

        <div className="ft-bug" data-reveal>
          <div className="ft-bug-copy">
            <span className="ft-bug-head">
              <MailIcon />
              <span className="ft-label">Found a bug</span>
            </span>
            <h3 className="ft-bug-title">Your export should just work.</h3>
            <p className="ft-bug-text">
              If the app breaks with your data, send your ZIP to {EMAIL} with a
              short note about what went wrong and I will try to fix it when I
              have time.
            </p>
          </div>

          <div className="ft-bug-action">
            <a
              className="ft-mail"
              href={GMAIL_COMPOSE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MailIcon />
              Send your ZIP
            </a>
            <span className="ft-bug-note">Opens Gmail in a new tab.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
