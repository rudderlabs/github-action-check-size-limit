import '@jest/globals';
import SizeLimit from './SizeLimit';

describe('SizeLimit', () => {
  test('should parse size-limit output', () => {
    const limit = new SizeLimit();
    const output = JSON.stringify([
      {
        name: 'dist/index.js',
        passed: true,
        size: '110894',
        running: '0.10210999999999999',
        loading: '2.1658984375',
      },
    ]);

    expect(limit.parseResults(output)).toEqual({
      'dist/index.js': {
        name: 'dist/index.js',
        loading: 2.1658984375,
        running: 0.10210999999999999,
        size: 110894,
        sizeLimit: NaN,
        passed: true,
        total: 2.2680084375000003,
      },
    });
  });

  test('should parse size-limit without times output', () => {
    const limit = new SizeLimit();
    const output = JSON.stringify([
      {
        name: 'dist/index.js',
        passed: true,
        size: '110894',
        sizeLimit: '120000',
      },
    ]);

    expect(limit.parseResults(output)).toEqual({
      'dist/index.js': {
        name: 'dist/index.js',
        size: 110894,
        sizeLimit: 120000,
        passed: true,
      },
    });
  });

  test('should parse size-limit of monorepo output', () => {
    const limit = new SizeLimit();
    const output = JSON.stringify([
      [
        {
          name: 'dist/index.js',
          passed: true,
          size: '110894',
        },
        {
          name: 'dist/new.js',
          passed: true,
          size: '100894',
        },
      ],
      [
        {
          name: 'dist/old.js',
          passed: true,
          size: '100894',
        },
      ],
      [],
    ]);

    expect(limit.parseResults(output)).toEqual({
      'dist/index.js': {
        name: 'dist/index.js',
        size: 110894,
        sizeLimit: NaN,
        passed: true,
      },
      'dist/new.js': {
        name: 'dist/new.js',
        size: 100894,
        sizeLimit: NaN,
        passed: true,
      },
      'dist/old.js': {
        name: 'dist/old.js',
        size: 100894,
        sizeLimit: NaN,
        passed: true,
      },
    });
  });

  test('should format size-limit results', () => {
    const limit = new SizeLimit();
    const base = {
      'dist/index.js': {
        name: 'dist/index.js',
        size: 110894,
        running: 0.10210999999999999,
        loading: 2.1658984375,
        total: 2.2680084375000003,
      },
    };
    const current = {
      'dist/index.js': {
        name: 'dist/index.js',
        size: 100894,
        sizeLimit: 110000,
        running: 0.20211,
        loading: 2.5658984375,
        total: 2.7680084375000003,
      },
    };

    expect(limit.formatResults(base, current)).toEqual([
      SizeLimit.TIME_RESULTS_HEADER,
      [
        'dist/index.js',
        '98.53 KB (-9.02% 🟢)',
        '2.6 s (+18.47% 🔺)',
        '203 ms (+97.94% 🔺)',
        '2.8 s',
      ],
    ]);
  });

  test('should format size-limit without times results', () => {
    const limit = new SizeLimit();
    const base = {
      'dist/index.js': {
        name: 'dist/index.js',
        size: 110894,
      },
    };
    const current = {
      'dist/index.js': {
        name: 'dist/index.js',
        size: 100894,
        sizeLimit: 110000,
      },
    };

    expect(limit.formatResults(base, current)).toEqual([
      SizeLimit.SIZE_RESULTS_HEADER,
      ['dist/index.js', '98.53 KB', '-9.77 KB (-9.02% 🟢)', '107.42 KB (✅)'],
    ]);
  });

  test('should format size-limit with new section', () => {
    const limit = new SizeLimit();
    const base = {
      'dist/index.js': {
        name: 'dist/index.js',
        size: 110894,
      },
    };
    const current = {
      'dist/index.js': {
        name: 'dist/index.js',
        size: 100894,
        sizeLimit: 110000,
      },
      'dist/new.js': {
        name: 'dist/new.js',
        size: 100894,
        sizeLimit: 110000,
      },
    };

    expect(limit.formatResults(base, current)).toEqual([
      SizeLimit.SIZE_RESULTS_HEADER,
      ['dist/index.js', '98.53 KB', '-9.77 KB (-9.02% 🟢)', '107.42 KB (✅)'],
      ['dist/new.js', '98.53 KB', '98.53 KB (+100% 🔺)', '107.42 KB (✅)'],
    ]);
  });

  test('should format size-limit with deleted section', () => {
    const limit = new SizeLimit();
    const base = {
      'dist/index.js': {
        name: 'dist/index.js',
        size: 110894,
      },
    };
    const current = {
      'dist/new.js': {
        name: 'dist/new.js',
        size: 100894,
      },
    };

    expect(limit.formatResults(base, current)).toEqual([
      SizeLimit.SIZE_RESULTS_HEADER,
      ['dist/index.js', '0 B', '-108.29 KB (-100% 🟢)', 'null (✅)'],
      ['dist/new.js', '98.53 KB', '98.53 KB (+100% 🔺)', 'null (✅)'],
    ]);
  });

  test('should format size-limit with limit breach', () => {
    const limit = new SizeLimit();
    const base = {
      'dist/index.js': {
        name: 'dist/index.js',
        size: 110894,
      },
    };
    const current = {
      'dist/index.js': {
        name: 'dist/index.js',
        size: 120894,
        sizeLimit: 110000,
      },
    };

    expect(limit.formatResults(base, current)).toEqual([
      SizeLimit.SIZE_RESULTS_HEADER,
      ['dist/index.js', '118.06 KB', '9.77 KB (+9.02% 🔺)', '107.42 KB (10.64 KB ❌)'],
    ]);
  });

  test('should detect a size limit breach', () => {
    const limit = new SizeLimit();
    const results = {
      'dist/index.js': {
        name: 'dist/index.js',
        passed: false,
        size: 120894,
        sizeLimit: 110000,
      },
    };

    expect(limit.hasExceededLimits(results)).toBe(true);
  });

  test('should detect a time limit breach', () => {
    // size-limit reports no sizeLimit for time based limits, only the passed flag
    const limit = new SizeLimit();
    const results = {
      'dist/index.js': {
        name: 'dist/index.js',
        passed: false,
        size: 110894,
        sizeLimit: NaN,
        running: 0.10210999999999999,
        loading: 2.1658984375,
        total: 2.2680084375000003,
      },
    };

    expect(limit.hasExceededLimits(results)).toBe(true);
  });

  test('should not detect a breach when every entry is within its limit', () => {
    const limit = new SizeLimit();
    const results = {
      'dist/index.js': {
        name: 'dist/index.js',
        passed: true,
        size: 100894,
        sizeLimit: 110000,
      },
    };

    expect(limit.hasExceededLimits(results)).toBe(false);
  });

  test('should not detect a breach when no limits are configured', () => {
    const limit = new SizeLimit();
    const results = {
      'dist/index.js': {
        name: 'dist/index.js',
        size: 100894,
        sizeLimit: NaN,
      },
    };

    expect(limit.hasExceededLimits(results)).toBe(false);
  });
});
