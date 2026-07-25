# Competition status migration fix

- Aligned migration `003` with the canonical competition-analysis states already
  defined by migration `004`.
- Preserved `estimated` as the explicit completed-analysis state for internally
  estimated market data; existing rows are not reset to `pending`.
- Added a regression test that keeps both migration constraints and the current
  application behavior compatible.

Risk: high-risk because the change affects a Production database constraint.
Manual review and merge are required.
