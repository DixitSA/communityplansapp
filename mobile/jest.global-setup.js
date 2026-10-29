// Dates are local (city) time; pin the zone so DST tests and date math are deterministic.
// This runs outside the test sandbox, so the setting reaches every worker.
module.exports = async () => {
  process.env.TZ = 'America/New_York';
};
