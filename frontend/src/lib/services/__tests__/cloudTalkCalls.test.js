import { cloudTalkCallTarget, cloudTalkCallSummary, formatPhoneDisplay } from '../cloudTalkCalls.js';

describe('formatPhoneDisplay', () => {
  it('adds a leading + when missing', () => {
    expect(formatPhoneDisplay('919810556482')).toBe('+919810556482');
  });

  it('leaves an existing + untouched', () => {
    expect(formatPhoneDisplay('+919810556482')).toBe('+919810556482');
  });

  it('returns an empty string for empty/null input', () => {
    expect(formatPhoneDisplay('')).toBe('');
    expect(formatPhoneDisplay(null)).toBe('');
  });
});

describe('cloudTalkCallTarget — "Name (number)" formatting', () => {
  it('shows "Name (+number)" when a contact name is available', () => {
    expect(cloudTalkCallTarget('919810556482', 'Narayan Desai')).toBe('Narayan Desai (+919810556482)');
  });

  it('shows only the number when no name is available', () => {
    expect(cloudTalkCallTarget('919810556482', null)).toBe('+919810556482');
    expect(cloudTalkCallTarget('919810556482', undefined)).toBe('+919810556482');
    expect(cloudTalkCallTarget('919810556482', '')).toBe('+919810556482');
  });

  it('shows only the name when there is no phone number at all', () => {
    expect(cloudTalkCallTarget(null, 'Narayan Desai')).toBe('Narayan Desai');
  });

  it('falls back to "unknown number" when neither is available', () => {
    expect(cloudTalkCallTarget(null, null)).toBe('unknown number');
  });
});

describe('listCloudTalkCallsLastDays', () => {
  it('returns stored calls when the CloudTalk API is unavailable', async () => {
    const api = (await import('../../api.js')).default;
    jest.spyOn(api, 'get').mockRejectedValue({ response: { status: 503 } });

    const { listCloudTalkCallsLastDays } = await import('../cloudTalkCalls.js');
    const calls = await listCloudTalkCallsLastDays(30, {}, { limit: 10 });
    expect(Array.isArray(calls)).toBe(true);
  });
});

describe('cloudTalkCallSummary', () => {
  it('builds an outgoing-call summary as "caller called contact(phone)"', () => {
    const summary = cloudTalkCallSummary({
      type: 'outgoing',
      status: 'answered',
      phone: '919810556482',
      contactName: 'Narayan Desai',
      duration: 24,
      callerName: 'John Smith',
    });
    expect(summary).toBe('John Smith called Narayan Desai(919810556482) (24s)');
  });

  it('falls back to legacy CloudTalk summary when caller name is missing', () => {
    const summary = cloudTalkCallSummary({
      type: 'outgoing',
      status: 'answered',
      phone: '919810556482',
      contactName: 'Narayan Desai',
      duration: 24,
    });
    expect(summary).toBe('Outgoing CloudTalk call with Narayan Desai (+919810556482) (24s)');
  });

  it('falls back to the bare number when no contact name resolves', () => {
    const summary = cloudTalkCallSummary({
      type: 'outgoing',
      status: 'answered',
      phone: '46767729039',
      contactName: null,
      duration: 0,
    });
    expect(summary).toBe('Outgoing CloudTalk call with +46767729039');
  });

  it('flags a missed call', () => {
    const summary = cloudTalkCallSummary({
      type: 'incoming',
      status: 'missed',
      phone: '919810556482',
      contactName: null,
      duration: 0,
    });
    expect(summary).toBe('Incoming CloudTalk call with +919810556482 (missed)');
  });
});
