create schema if not exists public;

create table if not exists blocks
(
    number               bigint          not null,
    hash                 char(66) unique not null,
    miner                char(42)        not null,
    extra_data           text,
    gas_limit            bigint,
    gas_used             bigint,
    timestamp            timestamp       not null,
    difficulty           bigint,
    logs_bloom           char(514),
    mix_hash             char(66),
    nonce                char(18),
    parent_hash          char(66),
    receipts_root        char(66),
    sha3_uncles          char(66),
    size                 bigint,
    state_root           char(66),
    transactions         char(66)[],
    staking_transactions char(66)[],
    transactions_root    char(66),
    uncles               char(66)[],
    epoch                bigint,
    view_id              text,
    primary key (number)
);

create index if not exists idx_blocks_number on blocks (number desc);
create index if not exists idx_blocks_hash on blocks using hash (hash);
create index if not exists idx_blocks_timestamp on blocks (timestamp);

create table if not exists logs
(
    address           char(42) not null,
    topics            char(66)[],
    data              text,
    block_number      bigint   not null,
    transaction_hash  char(66) not null,
    transaction_index smallint,
    block_hash        char(66) not null,
    log_index         smallint,
    removed           boolean,
    unique (transaction_hash, log_index)
);

-- create index if not exists idx_logs_address on logs using hash (address);
create index if not exists idx_logs_transaction_hash on logs using hash (transaction_hash);
-- create index if not exists idx_logs_block_hash on logs using hash (block_hash);
create index if not exists idx_logs_block_number on logs (block_number desc);
create index if not exists idx_logs_block_number_asc on logs (block_number);
create index if not exists idx_logs_block_number_address on logs (block_number desc, address);
create index if not exists idx_gin_logs_topics on logs using GIN (topics);

do
$$
    begin
        create type transaction_extra_mark as enum (
            'normal',
            'hasInternalONETransfers'
        );
    exception
        when duplicate_object then null;
    end
$$;

create table if not exists transactions
(
    shard             smallint                          not null,
    hash              char(66) unique primary key       not null,
    hash_harmony      char(66) unique                   not null,
    value             numeric,
    block_hash        char(66) references blocks (hash) not null,
    block_number      bigint references blocks (number) not null,
    timestamp         timestamp                         not null,
    "from"            char(42)                          not null,
    "to"              char(42),
    gas               bigint,
    gas_price         numeric,
    input             text,
    nonce             int,
    r                 text,
    s                 text,
    to_shard_id       smallint,
    transaction_index smallint,
    v                 text,
    success           boolean,
    error             text,
    extra_mark        transaction_extra_mark            default 'normal'
);
create index if not exists idx_transactions_hash on transactions using hash (hash);
create index if not exists idx_transactions_hash_harmony on transactions using hash (hash_harmony);
-- create index if not exists idx_transactions_block_hash on transactions using hash (block_hash);
create index if not exists idx_transactions_block_number on transactions (block_number desc);
create index if not exists idx_transactions_timestamp on transactions (timestamp);
create index if not exists idx_transactions_from_block_number on transactions ("from", block_number desc);
create index if not exists idx_transactions_to_block_number on transactions ("to", block_number desc);

do
$$
    begin
        create type staking_transaction_type as enum (
            'CreateValidator',
            'EditValidator',
            'CollectRewards',
            'Undelegate',
            'Delegate'
            );
    exception
        when duplicate_object then null;
    end
$$;

create table if not exists staking_transactions
(
    shard             smallint                          not null,
    hash              char(66) unique primary key       not null,
    block_hash        char(66) references blocks (hash) not null,
    block_number      bigint references blocks (number) not null,
    timestamp         timestamp                         not null,
    "from"            char(42)                          not null,
    "to"              char(42),
    gas               bigint,
    gas_price         bigint,
    input             text,
    nonce             int,
    r                 text,
    s                 text,
    to_shard_id       smallint,
    transaction_index smallint,
    v                 text,
    msg               jsonb,
    type              staking_transaction_type,
    /* amount from msg.amount or if type=CollectRewards from hmyv2_getTransactionReceipt tx.logs[0].data */
    amount            numeric
);

create index if not exists idx_staking_transactions_hash on staking_transactions using hash (hash);
create index if not exists idx_staking_transactions_block_hash on staking_transactions using hash (block_hash);
create index if not exists idx_staking_transactions_block_number on staking_transactions (block_number desc);
create index if not exists idx_staking_transactions_from_block_number on staking_transactions ("from", block_number desc);
create index if not exists idx_staking_transactions_to_block_number on staking_transactions ("to", block_number desc);

do
$$
    begin
        create type transaction_type as enum (
            'transaction',
            'staking_transaction',
            'internal_transaction',
            /*  transfers for erc tokens */
            'erc20',
            'erc721'
            );
    exception
        when duplicate_object then null;
    end
$$;

/*addresses mentioned in transaction*/
/*not used in the moment using address2transaction_fifo table to store latest 1000 records*/
create table if not exists address2transaction
(
    address          char(42)         not null,
    block_number     bigint           not null,
    transaction_hash char(66)         not null,
    transaction_type transaction_type not null,
    unique (address, transaction_hash, transaction_type)
);

create index if not exists idx_address2transaction_address_btree on address2transaction using btree (address);
create index if not exists idx_address2transaction_block_number on address2transaction using btree (block_number desc, address);

create index if not exists idx_address2transaction_address_transaction_btree on address2transaction using btree (address)
    where transaction_type = 'transaction';
create index if not exists idx_address2transaction_block_number_transaction on address2transaction using btree (block_number desc, address)
    where transaction_type = 'transaction';

create index if not exists idx_address2transaction_address_staking_transaction_btree on address2transaction using btree (address)
    where transaction_type = 'staking_transaction';
create index if not exists idx_address2transaction_block_number_staking_transaction on address2transaction using btree (block_number desc, address)
    where transaction_type = 'staking_transaction';

create index if not exists idx_address2transaction_address_internal_transaction_btree on address2transaction using btree (address)
    where transaction_type = 'internal_transaction';
create index if not exists idx_address2transaction_block_number_internal_transaction on address2transaction using btree (block_number desc, address)
    where transaction_type = 'internal_transaction';

create index if not exists idx_address2transaction_address_erc20_btree on address2transaction using btree (address)
    where transaction_type = 'erc20';
create index if not exists idx_address2transaction_block_number_erc20 on address2transaction using btree (block_number desc, address)
    where transaction_type = 'erc20';

create index if not exists idx_address2transaction_address_erc721_btree on address2transaction using btree (address)
    where transaction_type = 'erc721';
create index if not exists idx_address2transaction_block_number_erc721 on address2transaction using btree (block_number desc, address)
    where transaction_type = 'erc721';

create table if not exists address2transaction_fifo
(
    address            char(42)         not null,
    transaction_hashes char(66)[]       not null,
    transaction_type   transaction_type not null,
    unique (address, transaction_type)
);
create index if not exists idx_address2transaction_fifo_address_btree on address2transaction_fifo using btree (address, transaction_type);

create index if not exists idx_address2transaction_address_transaction_hash_fifo on address2transaction_fifo using hash (address)
    where transaction_type = 'transaction';
create index if not exists idx_address2transaction_address_staking_transaction_hash_fifo on address2transaction_fifo using hash (address)
    where transaction_type = 'staking_transaction';
create index if not exists idx_address2transaction_address_internal_transaction_hash_fifo on address2transaction_fifo using hash (address)
    where transaction_type = 'internal_transaction';
create index if not exists idx_address2transaction_address_erc20_hash_fifo on address2transaction_fifo using hash (address)
    where transaction_type = 'erc20';
create index if not exists idx_address2transaction_address_erc721_hash_fifo on address2transaction_fifo using hash (address)
    where transaction_type = 'erc721';


/*
types call staticcall create delegatecall
*/
create table if not exists internal_transactions
(
    index            integer                                not null,
    block_number     bigint                                  not null,
    "from"           char(42)                                not null,
    "to"             char(42), /*can be empty if error*/
    gas              bigint,
    gas_used         bigint,
    input            text,
    output           text,
    type             text                                    not null,
    value            numeric,
    transaction_hash char(66) references transactions (hash) not null,
    time             time,
    error            text,

    unique (transaction_hash, index)
);

create index if not exists idx_internal_transactions_transaction_hash on internal_transactions using hash (transaction_hash);
-- create index if not exists idx_internal_transactions_block_number on internal_transactions (block_number desc);
create index if not exists idx_internal_transactions_from_block_number on internal_transactions ("from", block_number desc);
create index if not exists idx_internal_transactions_to_block_number on internal_transactions ("to", block_number desc);

/*tracking create/create2 */
create table if not exists contracts
(
    address          char(42) unique not null,
    creator_address  char(42)        not null,
    block_hash       char(66)        not null,
    block_number     bigint          not null,
    transaction_hash char(66) references transactions (hash),
    ipfs_hash        char(64),
    solidity_version char(6),
    meta             jsonb,
    bytecode         text            not null
);
create index if not exists idx_contracts_address on contracts using hash (address);
create index if not exists idx_contracts_block_number on contracts (block_number desc);

create table if not exists erc20
(
    address                  char(42) unique references contracts (address) not null,
    decimals                 smallint                                       not null,
    symbol                   text                                           not null,
    name                     text                                           not null,
    total_supply             numeric default (0),
    circulating_supply       numeric default (0),
    holders                  numeric default (0),
    transaction_count        bigint  default (0),
    last_update_block_number bigint  default (0)
);

create index if not exists idx_erc20_address on erc20 using hash (address);

create table if not exists erc20_balance
(
    owner_address            char(42)                            not null,
    token_address            char(42) references erc20 (address) not null,
    balance                  numeric,
    need_update              boolean,
    last_update_block_number bigint,
    unique (owner_address, token_address)
);
create index if not exists idx_erc20_balance_address on erc20_balance using hash (owner_address);
create index if not exists idx_erc20_balance_token_address on erc20_balance using hash (token_address);

create table if not exists erc721
(
    address                  char(42) unique references contracts (address) not null,
    symbol                   text                                           not null,
    name                     text                                           not null,
    total_supply             numeric default (0),
    holders                  numeric default (0),
    transaction_count        bigint  default (0),
    last_update_block_number bigint  default (0)
);

create index if not exists idx_erc721_address on erc721 using hash (address);

create table if not exists erc721_asset
(
    owner_address            char(42)                             not null,
    token_address            char(42) references erc721 (address) not null,
    token_id                 text,
    token_uri                text,
    meta                     jsonb,
    need_update              boolean,
    last_update_block_number bigint,
    unique (token_address, token_id)
);

create index if not exists idx_erc721_asset_owner_address on erc721_asset using hash (owner_address);
create index if not exists idx_erc721_asset_token_address on erc721_asset using hash (token_address);

create table if not exists erc1155
(
    address                  char(42) unique references contracts (address) not null,
    symbol                   text                                           not null,
    name                     text                                           not null,
    total_supply             numeric default (0),
    holders                  numeric default (0),
    transaction_count        bigint  default (0),
    meta                     jsonb,
    contractURI              text,
    last_update_block_number bigint  default (0)
);

create index if not exists idx_erc1155_address on erc1155 using hash (address);


create table if not exists erc1155_asset
(
    token_address            char(42) references erc1155 (address) not null,
    token_id                 text,
    token_uri                text,
    meta                     jsonb,
    need_update              boolean,
    last_update_block_number bigint,
    unique (token_address, token_id)
);

create index if not exists idx_erc1155_asset_address on erc1155_asset using hash (token_address);
create index if not exists idx_erc1155_asset_token_id on erc1155_asset using hash (token_id);
/*todo index
  address hash
  */

create table if not exists erc1155_balance
(
    token_id                 text,
    owner_address            char(42)                              not null,
    token_address            char(42) references erc1155 (address) not null,
    amount                   bigint default (0),
    need_update              boolean,
    last_update_block_number bigint,
    unique (owner_address, token_id, token_address)
);

create index if not exists idx_erc1155_balance_token on erc1155_balance using hash (token_address);
create index if not exists idx_erc1155_balance_owner on erc1155_balance using hash (owner_address);
create index if not exists idx_erc1155_balance_token_id on erc1155_balance using hash (token_id);

create table if not exists signatures
(
    hash      varchar not null,
    signature text    not null,
    unique (hash, signature)
);
create index if not exists idx_event_signatures_hash on signatures using hash (hash);

create table if not exists indexer_state
(
    chain_id                 int,
    last_synced_block_number bigint default (0),
    indexer_name             varchar,
    unique (indexer_name)
);


create table if not exists wallets_count
(
    id serial primary key,
    date            timestamp default now(),
    date_string varchar unique not null,
    count bigint not null
);

create table if not exists transactions_count
(
    id serial primary key,
    date            timestamp default now(),
    date_string varchar unique not null,
    count bigint not null
);

do
$$
    begin
        ALTER TYPE transaction_type ADD VALUE 'erc1155' after 'erc721';
    exception
        when duplicate_object then null;
    end
$$;

do
$$
    begin
        create type contract_event_type as enum (
            'Transfer',
            'TransferBatch',
            'TransferSingle',
            'Approval',
            'ApprovalForAll'
            );
    exception
        when duplicate_object then null;
    end
$$;

create table if not exists contract_events
(
    block_number        bigint              not null,
    transaction_type    transaction_type    not null,
    event_type          contract_event_type not null,
    transaction_index   smallint,
    log_index           smallint,
    transaction_hash    char(66)            not null,
    address             char(42)            not null,
    "from"              char(42)            not null,
    "to"                char(42)            not null,
    value               numeric,
    unique (transaction_index, transaction_hash, log_index, "from", "to")
);

create index if not exists idx_contract_events_from_block_number on contract_events ("from", block_number desc);
create index if not exists idx_contract_events_to_block_number on contract_events ("to", block_number desc);
create index if not exists idx_contract_events_transaction_hash on contract_events using hash (transaction_hash);

create table if not exists onewallet_owners
(
    address             char(42) not null primary key,
    transaction_hash    char(66) not null,
    block_number        bigint not null
);

create table if not exists onewallet_metrics
(
    id                  serial primary key,
    created_at          timestamp unique not null default current_date,
    owners_count        bigint not null default (0),
    total_balance       numeric default (0)
);
