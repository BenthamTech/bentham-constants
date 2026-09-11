import {
  ApplicationStatusTab,
  APPLICATION_STATUS_TABS,
} from '../../src/application-status';

describe('application-status tabs', () => {
  it('APPLICATION_STATUS_TABS lists every friendly tab name', () => {
    expect([...APPLICATION_STATUS_TABS].sort()).toEqual(
      Object.values(ApplicationStatusTab).sort(),
    );
  });

  it('friendly tab names are unique', () => {
    expect(new Set(APPLICATION_STATUS_TABS).size).toBe(APPLICATION_STATUS_TABS.length);
  });

  it('exposes the two confirmed tabs', () => {
    expect(ApplicationStatusTab.PENDING_FOR_ACTION).toBe('pending_for_action');
    expect(ApplicationStatusTab.APPROVED).toBe('approved');
  });
});
