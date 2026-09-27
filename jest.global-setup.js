// Fixed timezone so date/DST tests are deterministic (Toronto: DST 2026-03-08 → 2026-11-01).
module.exports = async () => {
  process.env.TZ = 'America/Toronto';
};
