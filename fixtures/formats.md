# I03 synthetic format fixtures

`formats.jsonl`, `formats.json` and `formats.parquet` contain the same two rows:
`id` (int64), `zip` (string), and `amount` (decimal(20,4)). `document.json` wraps
the rows in a JSON object to exercise explicit document-as-jsonb ingestion.
Numbers are synthetic and include an integer above JavaScript's exact range.

The Parquet fixture was written using the platform's locked PyArrow runtime:

```python
import pyarrow as pa
import pyarrow.parquet as pq
from decimal import Decimal
pq.write_table(pa.table({
    'id': pa.array([9007199254740993, 2], type=pa.int64()),
    'zip': ['001', '002'],
    'amount': pa.array([Decimal('1234567890123456.1234'), Decimal('1.0000')],
                       type=pa.decimal128(20, 4)),
}), 'fixtures/formats.parquet')
```

The platform's installed release qualification runs `scripts/formats.mjs` through
the existing console harness. It uploads the actual fixture bytes through the
browser and validates database results, source preservation and durable reload.
