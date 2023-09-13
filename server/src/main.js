// Require the framework and instantiate it
const server = require('fastify')({ logger: false })
const cors = require('cors')
const axios = require('axios')

const { getData, setData, getHistoricalData, handleKlinesData, handleLastKlinesData, getLastKline, getVolumeData, handleVolumeData } = require('./database')

// Allow crossdomain requests
server.use(cors())

server.use((req,res,next)=>{
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,PATCH,DELETE');
    res.setHeader('Access-Control-Allow-Methods','Content-Type','Authorization');
    next();
})

// Declare a route
server.get('/nft/charts-storage/', async (request, reply) => {
    const symbol = request.query.symbol
    console.log(symbol)
    getData(symbol, cb => reply.status(200).send(cb || {}))
})

server.post('/nft/charts-storage/', (request, reply) => {
    const symbol = request.query.symbol
    setData({ symbol, content: request.body })
    reply.code(200).send({})
})

// server.get('/symbols', (request, reply) =>  {
//     const symbol = request.query.symbol
//     reply.code(200).send(symbol)
// })

// server.get('/klines', async (request, reply) =>  {
//     const symbol = request.query.symbol
//     const key = request.query.key
//     const floorPricedata = await getFloorPriceData(symbol, key, params=null)
//     const klinesData = handleKlinesData(floorPricedata.data, request.query.interval)
//     const ohlc = handleCandle(klinesData, floorPricedata.data)
//     reply.code(200).send(floorPricedata.data)
// })

server.get('/nft/symbols', (request, reply) =>  {
    const symbol = request.query.symbol
    reply.code(200).send(symbol)
})

server.get('/nft/klines', async (request, reply) =>  {
    // const symbol = request.query.symbol
    console.log("get Klines")
    const key = request.query.key
    const floorPricedata = await getHistoricalData({
        'collection_contract': request.query.collection_contract,
        'marketplaces': request.query.marketplaces,
        'start_date': request.query.start_date,
        'period': '1h'
    }, key)
    let volumedata = await getVolumeData()
    volumes = handleVolumeData(volumedata.data, floorPricedata.data.data, request.query.period)
    // console.log("floorPricedata", request.query.start_date)
    const klinesData = handleKlinesData(floorPricedata.data.data, volumes, request.query.period)
    // const ohlc = handleCandle(klinesData, floorPricedata.data)
    reply.code(200).send(klinesData)
})

server.get('/nft/lastkline', async (request, reply) =>  {
    const key = request.query.key
    const floorPricedata = await getHistoricalData({
            'collection_contract': request.query.collection_contract,
            'marketplaces': request.query.marketplaces,
            'start_date': request.query.start_date,
            'period': '1h'
        }, key)
    console.log("lastkline", request.query)
    let volumedata = await getVolumeData()
    volumes = handleVolumeData(volumedata.data, floorPricedata.data.data, request.query.period)

    const lastKline = handleLastKlinesData(floorPricedata.data.data, volumes, request.query.period)
    reply.code(200).send(lastKline)
})

server.listen(3000, (err, address) => {
    if (err) throw err
    console.log(address, 'server listening on http://localhost:3000')}
)