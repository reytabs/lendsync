'use client';

import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import posthog from 'posthog-js';

const STORAGE_PREFIX = 'lms_borrower_tour_v1';

function storageKey(email: string) {
  return `${STORAGE_PREFIX}:${email.toLowerCase()}`;
}

export function isBorrowerTourDone(email: string) {
  if (typeof window === 'undefined' || !email) return true;
  return localStorage.getItem(storageKey(email)) === '1';
}

export function markBorrowerTourDone(email: string) {
  if (typeof window === 'undefined' || !email) return;
  localStorage.setItem(storageKey(email), '1');
}

type TourOpts = {
  email: string;
  force?: boolean;
  ensureExpanded?: () => void;
};

function capture(event: string, props: Record<string, string> = {}) {
  try {
    posthog.capture(event, { role: 'borrower', ...props });
  } catch {
    // PostHog may be unset
  }
}

function buildSteps(): DriveStep[] {
  return [
    {
      element: '[data-tour="portal-brand"]',
      popover: {
        title: 'Welcome to your portal',
        description:
          'A quick look at how to apply, track loans, and manage documents.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="nav-portal-home"]',
      popover: {
        title: 'Home',
        description: 'Your overview — next steps and loan status at a glance.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="nav-portal-apply"]',
      popover: {
        title: 'Apply',
        description: 'Choose a loan product and submit a new application.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="nav-portal-loans"]',
      popover: {
        title: 'My loans',
        description:
          'Track applications, balances, and repayment schedules here.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="nav-portal-documents"]',
      popover: {
        title: 'Documents',
        description: 'Upload KYC and supporting files for your applications.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="nav-portal-profile"]',
      popover: {
        title: 'Profile',
        description: 'Keep your contact details up to date.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="portal-notifications"]',
      popover: {
        title: 'Notifications',
        description:
          'Get alerts when applications are decided or payments are due.',
        side: 'bottom',
        align: 'end',
      },
    },
  ];
}

let activeDriver: ReturnType<typeof driver> | null = null;
let completedViaDone = false;

export function startBorrowerTour(opts: TourOpts) {
  const { email, force = false, ensureExpanded } = opts;
  if (!email) return;
  if (!force && isBorrowerTourDone(email)) return;

  ensureExpanded?.();

  window.setTimeout(() => {
    if (activeDriver) {
      activeDriver.destroy();
      activeDriver = null;
    }

    completedViaDone = false;
    capture('borrower_tour_started');

    const d = driver({
      showProgress: true,
      animate: true,
      overlayOpacity: 0.55,
      stagePadding: 8,
      stageRadius: 8,
      allowClose: true,
      smoothScroll: true,
      skipMissingElement: true,
      popoverClass: 'lendsync-tour-popover',
      showButtons: ['next', 'previous', 'close'],
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Got it',
      progressText: '{{current}} of {{total}}',
      steps: buildSteps(),
      onPopoverRender: (popover) => {
        if (popover.closeButton) {
          popover.closeButton.setAttribute('aria-label', 'Skip');
          popover.closeButton.title = 'Skip';
        }
      },
      onCloseClick: (_el, _step, { driver: drv }) => {
        capture('borrower_tour_skipped');
        drv.destroy();
      },
      onNextClick: (_el, _step, { driver: drv }) => {
        if (drv.isLastStep()) {
          completedViaDone = true;
          capture('borrower_tour_completed');
          drv.destroy();
          return;
        }
        drv.moveNext();
      },
      onPrevClick: (_el, _step, { driver: drv }) => {
        drv.movePrevious();
      },
      onDestroyed: () => {
        markBorrowerTourDone(email);
        activeDriver = null;
        void completedViaDone;
      },
    });

    activeDriver = d;
    d.drive();
  }, force ? 80 : 500);
}
