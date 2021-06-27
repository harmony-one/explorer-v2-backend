# Harmony Blockchain Data Indexer

Indexer scrapes blocks, transactions (staking, call traces, logs), tracks contracts, ERC20 (aka HRC20) and ERC721 (aka HRC721) operations and balances
from Harmony blockchain and writes to postgres db.

API serves REST/JSON and websocket. Also, here is initial draft for GRPC. Will be implemented fully on community demand.

Possible to switch off API and keep active only Indexer and vice-versa.

# Run

## Define env variables

Copy `./mainnet.env.example` to `./.env` and define environment variables

## Development mode

```
yarn
yarn start
```

## Production mode

### Docker

```
docker build .
# map ports
docker run -p 8000:8000 -p 3002:3002 -p 3001:3001
```

# Indexer

[Postgres scheme](https://github.com/hypnagonia/harmony-explorer-v2/tree/master/src/store/postgres/sql)
![image info](https://github.com/hypnagonia/harmony-explorer-v2/blob/master/doc/scheme.png)

# API

## REST API

#### Block

list (with filters)
`/v0/shard/0/block`

By hash
`/v0/shard/0/block/hash/:hash`

By number
`/v0/shard/0/block/number/:number`

Approximate count
`/v0/shard/0/block/count`

#### Transaction

list (with filters)
`/v0/shard/0/transaction`

by ETH hash or Harmony hash
`/v0/shard/0/transaction/hash/:hash`

by block number
`/v0/shard/0/transaction/block/number/:number`

by block hash
`/v0/shard/0/transaction/block/hash/:blockHash`

Approximate count
`/v0/shard/0/transaction/count`

#### Staking Transaction

list (with filters)
`/v0/shard/0/stakingTransaction`

by Harmony hash
`/v0/shard/0/stakingTransaction/hash/:txHash`

by block number
`/v0/shard/0/stakingTransaction/block/number/:blockNumber`

by block hash
`/v0/shard/0/stakingTransaction/block/hash/:blockHash`

Approximate count
`/v0/shard/0/stakingTransaction/count`

#### Address

related transactions (with filters)
`/v0/shard/0/address/:address/transactions`

#### Filters

as GET params

`orderBy`: `number` for blocks | `block_number` for txs

`orderDirection`: `asc` | `desc`

`offset`: number

`limit`: number (max `100`)

Composite filters (at the moment only single condition supported)

`type`: `gt` | `gte` | `lt` | `lte`

`property`: `number` | `block_number` (will be more in the future)

`value`: value

Example
`/v0/shard/0/block?limit=2&offset=0&orderBy=number&orderDirection=asc&type=gt&property=number&value=40`

## Websocket [Socket.IO](https://socket.io/)

Hit http://localhost:3001 for dev web page

Check the [controllers](https://github.com/hypnagonia/harmony-explorer-v2/tree/dev2/src/api/controllers) files for method names and params

## GRPC

[Proto files](https://github.com/hypnagonia/harmony-explorer-v2/tree/master/src/api/grpc/proto)

#### Query

Using [GRPC CLI](https://github.com/grpc/grpc/blob/master/doc/command_line_tool.md)

Install

```
brew install grpc
```

Query

```
grpc_cli --protofiles=src/api/grpc/proto/api.proto call 127.0.0.1:5051 GetBlockByNumber "blockNumber: 1, shardID: 0"
grpc_cli --protofiles=src/api/grpc/proto/api.proto call 127.0.0.1:5051 GetBlockByHash "shardID:0, blockHash:'0xb4d158b82ac8a653c42b78697ab1cd0c6a0d9a15ab3bc34130f0b719fb174d2a'"
```

## TODO

### Indexer

- [x] Index Blocks
- [x] Index Transactions
- [x] Index Staking Transactions
- [x] Index Events
- [x] Track transactions for Address
- [x] Index Transactions Trace Calls
- [x] Index Internal Transactions
- [x] Detect Contracts
- [x] Track HRC20
- [x] Track HRC721
- [ ] Track Balances
- [ ] Contract Verification
- [x] Methods/Events signature db

#### REST

- [x] Blocks
- [x] Transactions
- [x] Staking Transactions
- [x] Internal Transactions
- [x] Addresses
- [x] Metrics
- [x] ERC20 tokens
- [x] ERC721 tokens
- [ ] Documentation

### Misc

- [ ] Docker image
