'use client';
import { useId } from 'react';

const TOP_PATH = 'M17.9166 13.8848C17.758 12.6992 17.3704 11.5569 16.776 10.5232C16.1815 9.48952 15.3919 8.58463 14.4522 7.86027C13.5125 7.13591 12.4411 6.60628 11.2993 6.30163C10.1576 5.99699 8.96772 5.92332 7.79782 6.08481C5.43311 6.40924 3.29225 7.67174 1.84574 9.59486C0.399228 11.518 -0.234584 13.9444 0.0835927 16.3408C0.00686993 15.7702 0.156978 15.1921 0.500894 14.7337C0.84481 14.2752 1.35436 13.974 1.91746 13.8963C2.48055 13.8185 3.05106 13.9706 3.50348 14.3191C3.9559 14.6676 4.25317 15.1839 4.32989 15.7545C4.1651 14.4994 4.49852 13.2293 5.25695 12.223C6.01539 11.2167 7.13687 10.5564 8.37523 10.3872C8.98747 10.3025 9.61017 10.341 10.2077 10.5003C10.8053 10.6597 11.366 10.9369 11.8577 11.316C12.3495 11.6951 12.7627 12.1687 13.0737 12.7097C13.3847 13.2507 13.5875 13.8486 13.6703 14.4691C13.7401 14.9891 13.9935 15.466 14.3835 15.8113C14.7735 16.1567 15.2737 16.3473 15.7917 16.3478C15.8891 16.3477 15.9864 16.3411 16.0829 16.3279C16.6457 16.2501 17.155 15.9491 17.4989 15.491C17.8427 15.0328 17.993 14.4551 17.9166 13.8848Z';
const BOTTOM_PATH = 'M17.9163 13.8846C17.9928 14.4551 17.8425 15.0331 17.4985 15.4913C17.1545 15.9496 16.6449 16.2506 16.0819 16.3281C15.9854 16.3413 15.8881 16.348 15.7907 16.3481C15.2727 16.3476 14.7724 16.157 14.3824 15.8116C13.9924 15.4662 13.7391 14.9894 13.6693 14.4693C14.0203 17.0836 12.2144 19.4986 9.64359 19.8527C9.02915 19.9374 8.40426 19.8986 7.80463 19.7385C7.20499 19.5785 6.64236 19.3002 6.14888 18.9197C5.6554 18.5393 5.24073 18.064 4.92858 17.5211C4.61643 16.9781 4.41291 16.3782 4.32964 15.7556C4.25292 15.185 3.95565 14.6687 3.50323 14.3202C3.05081 13.9717 2.48031 13.8196 1.91721 13.8973C1.35412 13.9751 0.844564 14.2763 0.500648 14.7347C0.156731 15.1932 0.00662365 15.7712 0.0833464 16.3418C0.376714 18.526 1.44011 20.5289 3.07717 21.9806C4.71423 23.4323 6.81438 24.2348 8.98981 24.2399C9.40188 24.2397 9.81347 24.2114 10.2218 24.1551C11.3929 23.9936 12.5212 23.5998 13.542 22.996C14.5628 22.3923 15.4561 21.5905 16.1708 20.6366C16.8855 19.6827 17.4075 18.5953 17.707 17.4367C18.0065 16.2781 18.0777 15.0711 17.9163 13.8846Z';

const DISPLAY_FONT = "'Archivo Black', 'Arial Black', 'Helvetica Neue', Arial, sans-serif";

/**
 * Origami wordmark as on origami.dev: the folded "O" mark followed by "rigami." — plus an
 * optional product name ("CRM"). `variant="light"` is all white, for red or dark backgrounds.
 * Sized by font size: pass a text-* class in className.
 */
export default function OrigamiLogo({ variant = 'color', suffix = 'CRM', className = 'text-2xl' }) {
  const id = useId().replace(/:/g, '');
  const light = variant === 'light';
  const topFill = light ? '#FFFFFF' : `url(#${id}-top)`;
  const bottomFill = light ? 'rgba(255,255,255,0.72)' : `url(#${id}-bottom)`;

  return (
    <span className={`inline-flex items-baseline leading-none select-none ${className}`} aria-label={suffix ? `Origami ${suffix}` : 'Origami'}>
      <span className="inline-flex items-center gap-[0.1em]" aria-hidden="true">
        <svg viewBox="0 0 18 18" className="h-[0.95em] w-[0.95em] shrink-0 self-center">
          <g transform="translate(0, -6)">
            <path d={TOP_PATH} fill={topFill} />
            <path d={BOTTOM_PATH} fill={bottomFill} />
          </g>
          {!light && (
            <defs>
              <linearGradient id={`${id}-top`} x1="16.28" y1="11.17" x2="3.17" y2="11.17" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FF4048" />
                <stop offset="1" stopColor="#BD151D" />
              </linearGradient>
              <linearGradient id={`${id}-bottom`} x1="0" y1="19" x2="18" y2="19" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FF4048" />
                <stop offset="1" stopColor="#BD151D" />
              </linearGradient>
            </defs>
          )}
        </svg>
        <span
          className={light ? 'text-white' : 'text-[#0D0D0D]'}
          style={{ fontFamily: DISPLAY_FONT, fontWeight: 900, letterSpacing: '-0.04em' }}
        >
          rigami<span className={light ? 'text-white' : 'text-[#E8382C]'}>.</span>
        </span>
      </span>
      {suffix && (
        <span
          className={`ml-[0.3em] font-semibold tracking-tight ${light ? 'text-white/85' : 'text-zoho-muted'}`}
          style={{ fontSize: '0.72em' }}
          aria-hidden="true"
        >
          {suffix}
        </span>
      )}
    </span>
  );
}
