### TODO:

1. Implement auto-migrations
2. Add ORM

### Manual migrations list

### Date: 25.07.23

#### Description

New `metrics_type` enum value: 'total_fee'

```sql
ALTER TYPE metrics_type ADD VALUE 'total_fee';
```

#### Date: 21.03.23

#### Description

Add `block_number` column to tables `erc721_asset` and `erc1155_assets`

```sql
ALTER TABLE erc721_asset
ADD COLUMN block_number bigint default 0;
```

```sql
ALTER TABLE erc1155_asset
ADD COLUMN block_number bigint default 0;
```
