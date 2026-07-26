'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getAvailableOnboardingSteps,
  isOnboardingComplete,
  markOnboardingComplete,
  ONBOARDING_RESTART_EVENT,
  resetOnboarding,
} from '../../lib/onboardingTour.js';

const PADDING = 8;
const TOOLTIP_GAP = 14;

function getTargetRect(selector) {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function getTooltipStyle(rect, placement) {
  if (!rect || placement === 'center') {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      maxWidth: '24rem',
    };
  }

  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const tooltipW = Math.min(320, viewportW - 32);
  const style = { maxWidth: `${tooltipW}px` };

  if (placement === 'right') {
    style.top = `${Math.min(Math.max(rect.top, 16), viewportH - 200)}px`;
    style.left = `${Math.min(rect.left + rect.width + TOOLTIP_GAP, viewportW - tooltipW - 16)}px`;
    return style;
  }

  if (placement === 'top') {
    style.left = `${Math.min(Math.max(rect.left + rect.width / 2, tooltipW / 2 + 16), viewportW - tooltipW / 2 - 16)}px`;
    style.top = `${Math.max(rect.top - TOOLTIP_GAP, 16)}px`;
    style.transform = 'translate(-50%, -100%)';
    return style;
  }

  // bottom (default)
  style.left = `${Math.min(Math.max(rect.left + rect.width / 2, tooltipW / 2 + 16), viewportW - tooltipW / 2 - 16)}px`;
  style.top = `${Math.min(rect.top + rect.height + TOOLTIP_GAP, viewportH - 180)}px`;
  style.transform = 'translateX(-50%)';
  return style;
}

export default function OnboardingTour({ userId }) {
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState(null);

  const startTour = useCallback(() => {
    const available = getAvailableOnboardingSteps();
    if (!available.length) return;
    setSteps(available);
    setStepIndex(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!userId || isOnboardingComplete(userId)) return undefined;
    const timer = window.setTimeout(startTour, 700);
    return () => window.clearTimeout(timer);
  }, [userId, startTour]);

  useEffect(() => {
    const onRestart = () => {
      if (!userId) return;
      resetOnboarding(userId);
      startTour();
    };
    window.addEventListener(ONBOARDING_RESTART_EVENT, onRestart);
    return () => window.removeEventListener(ONBOARDING_RESTART_EVENT, onRestart);
  }, [userId, startTour]);

  const refreshRect = useCallback(() => {
    const step = steps[stepIndex];
    setRect(step?.target ? getTargetRect(step.target) : null);
  }, [steps, stepIndex]);

  useEffect(() => {
    if (!open) return undefined;
    refreshRect();
    window.addEventListener('resize', refreshRect);
    window.addEventListener('scroll', refreshRect, true);
    return () => {
      window.removeEventListener('resize', refreshRect);
      window.removeEventListener('scroll', refreshRect, true);
    };
  }, [open, refreshRect]);

  const finish = useCallback(() => {
    if (userId) markOnboardingComplete(userId);
    setOpen(false);
  }, [userId]);

  const goNext = () => {
    if (stepIndex >= steps.length - 1) finish();
    else setStepIndex((i) => i + 1);
  };

  const goBack = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  if (!open || !steps.length) return null;

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const tooltipStyle = getTooltipStyle(rect, step.placement);

  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-labelledby="onboarding-tour-title">
      {rect ? (
        <div
          className="absolute rounded-xl pointer-events-none ring-2 ring-brand-400 ring-offset-2 ring-offset-transparent transition-all duration-300"
          style={{
            top: rect.top - PADDING,
            left: rect.left - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.62)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-900/60" />
      )}

      <div
        className="absolute z-[201] w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-zoho-border bg-white p-5 shadow-card-hover animate-scaleIn"
        style={tooltipStyle}
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
          Step {stepIndex + 1} of {steps.length}
        </p>
        <h2 id="onboarding-tour-title" className="mt-1 text-base font-semibold text-zoho-text">
          {step.title}
        </h2>
        <p className="mt-2 text-sm text-zoho-muted leading-relaxed">{step.body}</p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="text-xs font-medium text-zoho-muted hover:text-zoho-text transition-colors"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button type="button" onClick={goBack} className="btn-secondary-sm">
                Back
              </button>
            )}
            <button type="button" onClick={goNext} className="btn-primary-sm">
              {isLast ? 'Get started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
