const TARGET_ID = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';

async function loadNavigation(staticExport) {
  process.env.NEXT_PUBLIC_STATIC_EXPORT = staticExport;
  jest.resetModules();
  return import('../recordNavigation.js');
}

describe('salesTargetEditHref', () => {
  const prev = process.env.NEXT_PUBLIC_STATIC_EXPORT;

  afterEach(() => {
    process.env.NEXT_PUBLIC_STATIC_EXPORT = prev;
    jest.resetModules();
  });

  it('uses placeholder shell and query id on static export', async () => {
    const { salesTargetEditHref } = await loadNavigation('true');
    expect(salesTargetEditHref(TARGET_ID)).toBe(
      `/settings/sales-targets/_/edit/?id=${encodeURIComponent(TARGET_ID)}`,
    );
  });

  it('uses direct path in dev / non-static builds', async () => {
    const { salesTargetEditHref } = await loadNavigation('false');
    expect(salesTargetEditHref(TARGET_ID)).toBe(`/settings/sales-targets/${TARGET_ID}/edit/`);
  });
});

describe('companyDetailHref', () => {
  const prev = process.env.NEXT_PUBLIC_STATIC_EXPORT;

  afterEach(() => {
    process.env.NEXT_PUBLIC_STATIC_EXPORT = prev;
    jest.resetModules();
  });

  it('uses placeholder shell and query id on static export', async () => {
    const { companyDetailHref } = await loadNavigation('true');
    expect(companyDetailHref(TARGET_ID)).toBe(`/companies/_/?id=${encodeURIComponent(TARGET_ID)}`);
  });
});
