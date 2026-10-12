import { paginate } from '@api/common/utils/pagination.js';

describe('paginate', () => {
  it('calculates the final page flags from the actual total', () => {
    expect(paginate(2, 12, 13)).toEqual({
      page: 2,
      limit: 12,
      total: 13,
      totalPages: 2,
      hasNext: false,
      hasPrev: true,
    });
  });
});
