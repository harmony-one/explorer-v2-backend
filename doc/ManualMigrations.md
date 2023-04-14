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

#### Date: 2022

```sql
create type transaction_extra_mark as enum (
            'normal',
            'hasInternalONETransfers'
        );

alter table transactions add column extra_mark transaction_extra_mark default 'normal'


create table if not exists transactions_count
(
    id serial primary key,
    date            timestamp default now(),
    date_string varchar unique not null,
    count bigint not null
);

        create type metrics_type as enum (
            'wallets_count',
            'transactions_count',
            'average_fee',
            'block_size'
            );


create table if not exists metrics_daily
(
    id                  serial primary key,
    type                metrics_type,
    date                varchar not null,
    value               varchar not null,
    created_at          timestamp default now(),
    unique (type, date)
);


create type metrics_top_type as enum (
            'top_one_sender',
            'top_one_receiver',
            'top_txs_count_sent',
            'top_txs_count_received'
            );


create table if not exists metrics_top
(
    type                metrics_top_type,
    period              smallint not null,
    address             char(42) not null,
    value               numeric,
    rank                smallint not null,
    share               real default (0),
    updated_at          timestamp default now(),
    unique (type, period, address)
);
```
