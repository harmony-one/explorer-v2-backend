### TODO:

1. Implement auto-migrations
2. Add ORM

### Manual migrations list

#### Date: 21.03.23

#### Description: add `block_number` column to tables `erc721_asset` and `erc1155_assets`

```sql
ALTER TABLE erc721_asset
ADD COLUMN block_number bigint default 0;
```

```sql
ALTER TABLE erc1155_asset
ADD COLUMN block_number bigint default 0;
```
