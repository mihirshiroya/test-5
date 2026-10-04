import React from 'react';
import { Check } from 'lucide-react';
import logo from '../../assets/logo.png';
import halftoneBackground from '../../assets/auth-halftone.png';

interface AuthLayoutProps {
  /* Left panel */
  eyebrow: string;
  headline: string;
  points?: string[];
  /** Optional wordmarks rendered as a 3-col logo wall at the bottom of the left panel */
  brands?: string[];

  /* Card */
  title: string;
  description?: string;
  footer?: React.ReactNode;

  children: React.ReactNode;
}

/* Shared class names so every auth screen has identical buttons */
export const authPrimaryButton = 'auth-button auth-button--primary';
export const authOutlineButton = 'auth-button auth-button--outline';
export const authLinkClass = 'auth-link';

export const GoogleIcon: React.FC = () => (
  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export const AuthDivider: React.FC = () => (
  <div className="auth-divider"><span>OR</span></div>
);

/* Small white square with a dark border — the "selection handle" marker
   shown at frame/card corners in the reference design */
const Handle: React.FC<{ position: string }> = ({ position }) => (
  <span
    aria-hidden="true"
    className={`auth-handle pointer-events-none absolute size-[7px] ${position}`}
  />
);

const CornerHandles: React.FC = () => (
  <>
    <Handle position="-left-[4px] -top-[4px]" />
    <Handle position="-right-[4px] -top-[4px]" />
    <Handle position="-left-[4px] -bottom-[4px]" />
    <Handle position="-right-[4px] -bottom-[4px]" />
  </>
);

/* Halftone dot texture layered over the blue-violet gradient (right panel) */
const backgroundStyle: React.CSSProperties = {
  backgroundImage: `url(${halftoneBackground})`,
};

/* Wordmarks in the reference each use a different typographic style */
const brandStyles = [
  'font-black italic tracking-tight',
  'font-black uppercase tracking-wider',
  'font-bold lowercase tracking-tight',
  'font-extrabold tracking-tight',
  'font-black uppercase tracking-widest',
  'font-semibold italic tracking-tight',
];
const workspaceFeatures = ['Tasks', 'Calendar', 'Notes', 'Projects', 'Focus', 'Workspaces'];

const AuthLayout: React.FC<AuthLayoutProps> = ({
  eyebrow,
  headline,
  points = [],
  brands = [],
  title,
  description,
  footer,
  children,
}) => {
  const wordmarks = brands.length ? brands : workspaceFeatures;

  return (
    <main className="auth-layout">
      {/* =====================================================
          Left: message panel with frame + handles (desktop only)
      ====================================================== */}
      <section className="auth-editorial" aria-label="Your workspace">
        {/* Frame lines running off toward the center divide */}
        <div aria-hidden="true" className="auth-editorial-frame">
          <Handle position="-left-[4px] -top-[4px]" />
          <Handle position="-left-[4px] -bottom-[4px]" />
        </div>
        <div className="auth-editorial-content">
          <span className="auth-eyebrow">{eyebrow}</span>
          <h1 className="auth-headline">{headline}</h1>
          {points.length > 0 && (
            <ul className="auth-benefits">
              {points.map((point) => (
                <li key={point}>
                  <span className="auth-check"><Check size={11} strokeWidth={2} aria-hidden="true" /></span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="auth-wordmarks" aria-label={brands.length ? 'Partners' : 'Workspace features'}>
            {wordmarks.map((wordmark, i) => (
              <span key={wordmark} className={brandStyles[i % brandStyles.length]}>{wordmark}</span>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================
          Right: halftone gradient + card with handles
      ====================================================== */}
      <section className="auth-form-panel" aria-labelledby="auth-form-title">
        <div className="auth-background" style={backgroundStyle} aria-hidden="true" />
        {/* Card */}
        <div className="auth-card">
          <div className="auth-logo"><img src={logo} alt="Workspace logo" /></div>
          {/* Inner bordered box with handles wrapping the form */}
          <div className="auth-form-frame">
            <CornerHandles />
            <header className="auth-form-heading">
              <h2 id="auth-form-title">{title}</h2>
              {description && <p>{description}</p>}
            </header>
            {children}
            {footer && <div className="auth-footer">{footer}</div>}
          </div>
        </div>
      </section>
    </main>
  );
};

export default AuthLayout;
