import {
  normalizePhoneForDial,
  cloudTalkPhoneUrl,
  buildCloudTalkDeepLink,
  tryCloudTalkDesktopDial,
  copyPhoneToClipboard,
  displayPhoneWithoutAutoDetect,
  formatPhoneForDisplay,
} from '../cloudTalkHelpers.js';

describe('normalizePhoneForDial', () => {
  it('adds a + and assumes US country code for a bare 10-digit number', () => {
    expect(normalizePhoneForDial('9810556482')).toBe('+19810556482');
  });

  it('preserves an existing international number with +', () => {
    expect(normalizePhoneForDial('+919810556482')).toBe('+919810556482');
  });

  it('strips formatting characters', () => {
    expect(normalizePhoneForDial('+91 (981) 055-6482')).toBe('+919810556482');
  });

  it('rejects text that is not a phone number', () => {
    expect(normalizePhoneForDial('not a number')).toBe('');
    expect(normalizePhoneForDial('John Smith')).toBe('');
  });

  it('rejects numbers that are too short to be real', () => {
    expect(normalizePhoneForDial('12345')).toBe('');
  });

  it('returns empty string for empty/null input', () => {
    expect(normalizePhoneForDial('')).toBe('');
    expect(normalizePhoneForDial(null)).toBe('');
  });
});

describe('cloudTalkPhoneUrl', () => {
  it('only includes the documented `partner` query param', () => {
    const url = cloudTalkPhoneUrl({ partner: 'sale-crm' });
    expect(url).toBe('https://phone.cloudtalk.io?partner=sale-crm');
  });

  it('does not accept/leak a number into the URL (CloudTalk does not document this)', () => {
    // Even if a caller mistakenly passes extra fields, only `partner` is used.
    const url = cloudTalkPhoneUrl({ partner: 'sale-crm', number: '+919810556482' });
    expect(url).not.toContain('9810556482');
  });
});

describe('buildCloudTalkDeepLink', () => {
  it('builds a ct+tel: link with the callee number', () => {
    expect(buildCloudTalkDeepLink('+919810556482')).toBe('ct+tel:%2B919810556482');
  });

  it('appends a `from` param when a source number is given', () => {
    expect(buildCloudTalkDeepLink('+919810556482', '+421910988342')).toBe(
      'ct+tel:%2B919810556482?from=%2B421910988342',
    );
  });

  it('returns empty string for an invalid target number', () => {
    expect(buildCloudTalkDeepLink('not a number')).toBe('');
  });
});

describe('tryCloudTalkDesktopDial', () => {
  it('returns false for an invalid number without touching the DOM', () => {
    const createSpy = jest.spyOn(document, 'createElement');
    expect(tryCloudTalkDesktopDial('not a number')).toBe(false);
    expect(createSpy).not.toHaveBeenCalled();
    createSpy.mockRestore();
  });

  it('creates a ct+tel: anchor with the right href and clicks it for a valid number', () => {
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const result = tryCloudTalkDesktopDial('+919810556482', '+421910988342');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
    clickSpy.mockRestore();
  });
});

describe('displayPhoneWithoutAutoDetect', () => {
  it('looks identical to the number but contains a zero-width space after the +', () => {
    const result = displayPhoneWithoutAutoDetect('+16507736053');
    expect(result).toBe('+​16507736053');
    // Visually indistinguishable — stripping the invisible char reproduces the original.
    expect(result.replace(/​/g, '')).toBe('+16507736053');
  });

  it('breaks a naive E.164 regex match (the browser extension\'s detection pattern)', () => {
    const e164Pattern = /^\+\d{7,15}$/;
    expect(e164Pattern.test('+16507736053')).toBe(true);
    expect(e164Pattern.test(displayPhoneWithoutAutoDetect('+16507736053'))).toBe(false);
  });

  it('passes through falsy input unchanged', () => {
    expect(displayPhoneWithoutAutoDetect('')).toBe('');
    expect(displayPhoneWithoutAutoDetect(null)).toBeNull();
  });
});

describe('formatPhoneForDisplay', () => {
  it('does not invent +1 for a bare 10-digit number', () => {
    expect(formatPhoneForDisplay('9810556482')).toBe('9810556482');
  });

  it('keeps an international + number readable without auto-detect wrapping', () => {
    const result = formatPhoneForDisplay('+919810556482');
    expect(result.replace(/​/g, '')).toBe('+919810556482');
    expect(result).toContain('​');
  });

  it('passes through empty input', () => {
    expect(formatPhoneForDisplay('')).toBe('');
    expect(formatPhoneForDisplay(null)).toBeNull();
  });
});

describe('copyPhoneToClipboard', () => {
  const originalClipboard = navigator.clipboard;

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true });
  });

  it('writes the number to the clipboard and resolves true on success', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const result = await copyPhoneToClipboard('+919810556482');
    expect(writeText).toHaveBeenCalledWith('+919810556482');
    expect(result).toBe(true);
  });

  it('resolves false when the clipboard API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    expect(await copyPhoneToClipboard('+919810556482')).toBe(false);
  });

  it('resolves false when the clipboard write is rejected (e.g. permissions)', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    expect(await copyPhoneToClipboard('+919810556482')).toBe(false);
  });

  it('resolves false for an empty number without calling the clipboard API', async () => {
    const writeText = jest.fn();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    expect(await copyPhoneToClipboard('')).toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });
});
