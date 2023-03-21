### TODO:

1. Implement auto-migrations
2. Add ORM

### Manual migrations list

#### Date: 21.03.23

#### Description: add `create_at` column to erc721_asset and erc1155_assets tables to enable tokens sorting

```sql
ALTER TABLE erc721_asset
ADD COLUMN created_at timestamp default now();
```

```sql
ALTER TABLE erc1155_asset
ADD COLUMN created_at timestamp default now();
```
