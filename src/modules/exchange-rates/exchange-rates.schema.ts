export const getLatestRatesSchema = {};

export const getRatesByDateSchema = {
  params: {
    type: 'object',
    required: ['date'],
    properties: {
      date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    },
  },
};
