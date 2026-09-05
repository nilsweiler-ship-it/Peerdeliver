-- Add the XL package class.
--
-- The size taxonomy stopped at L, which was parcel thinking carried into a
-- service whose advantage begins exactly where parcels end. Swiss Post's
-- Sperrgut tops out at 30 kg / 200 cm and costs about CHF 31; above that Post
-- declines the item entirely and the alternative is a Möbeltaxi at CHF 100+.
-- Without XL, a sofa and a bookshelf were priced identically and both landed
-- inside Post's price band, where we cannot win.
--
-- Purely additive: no existing row changes class, and L keeps its meaning.

ALTER TYPE "PackageSize" ADD VALUE IF NOT EXISTS 'XL';
