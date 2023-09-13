// Init database
const Datastore = require('nedb')
const axios = require('axios')
// const url = 'https://api-bff.nftpricefloor.com/nft/azuki/chart/pricefloor?interval=all'
// const PERIOD = {
//     "HOUR": 8 * 60 * 60 * 1000,
//     "DAY": 24 * 60 * 60 * 1000,
//     "WEEK": 7 * 24 * 60 * 60 * 1000
// }
const real_url = 'https://api.nftscoring.com/api/v1/prices/floor/?'
const historical_url = 'https://api.nftscoring.com/api/v1/prices/historical_floor/?'
const volume_url = 'https://api-bff.nftpricefloor.com/nft/azuki/chart/pricefloor?interval=all'
const PERIOD = {
    // "1m": 1 * 60 * 1000,
    // "5m": 5 * 60 * 1000,
    // "15m": 15 * 60 * 1000,
    // "30m": 30 * 60 * 1000,
    "1h": 1 * 60 * 60 * 1000,
    "2h": 2 * 60 * 60 * 1000,
    "8h": 8 * 60 * 60 * 1000,
    "12h": 12 * 60 * 60 * 1000,
    "1D": 24 * 60 * 60 * 1000,
    "1W": 7 * 24 * 60 * 60 * 1000
}


var db = new Datastore({
    filename: 'tradingview.db',
    autoload: true,
    inMemoryOnly: false,
})

// increased productivity, conversion to single-line format
db.persistence.compactDatafile()
db.persistence.setAutocompactionInterval(60 * 1000) // every 1m

const getData = async (symbol, callback) => {
    db.findOne({ symbol }).exec((err, doc) => {
        console.log(err, doc)
        callback(doc.content)})
}

const setData = ({ symbol, content }) => {
    return db.findOne({ symbol }, (err, doc) => {
        if (doc) {
            // 1 - search, 2 - update data, 3 - options
            return db.update({ symbol }, { $set: { content } }, {})
        }

        return db.insert({ symbol, content })
    })
}

const getHistoricalData = async (params, key) => {
    return await axios({
        url: historical_url,
        method: 'GET',
        headers: {
            'Authorization': 'Token ' + key
        },
        params: {
            // access_key: key,
            output: 'JSON',
            ...params
        }
    })
}

const getVolumeData = async (params, key) => {
    return await axios({
        url: volume_url,
        method: 'GET'
    })
}

const getLastKline = async (params, key) => {
    console.log(params)
    return await axios({
        url: real_url,
        method: 'GET',
        headers: {
            'Authorization': 'Token ' + key
        },
        params: {
            // access_key: key,
            output: 'JSON',
            ...params
        }
    })
}

const getMinMax = (pdata) => {
    if (pdata.length == 1)
        return {'low': pdata.floor_price_all, 'high': pdata.floor_price_all}
    pdata.sort((a,b)=> a.floor_price_all > b.floor_price_all ? 1 : -1)
    const low = pdata[0].floor_price_all == null ? pdata[1].floor_price_all : pdata[0].floor_price_all
    const high = pdata[pdata.length-1].floor_price_all == null ? pdata[pdata.length-2].floor_price_all : pdata[pdata.length-1].floor_price_all
    return {low, high} || {}
}

const handleKlinesData = (data, volumes, interval) => {
    let result = []
    let bunch = []
    const startDate = Math.floor(new Date(data[0].timestamp).getTime()/PERIOD[interval])
    const date = startDate*PERIOD[interval]
    let compDate = date + PERIOD[interval]
    console.log('handleKlinesData')
    for (let i=0; i<data.length; i++) {
        bunch.push(data[i])
        const dateTime = new Date(data[i].timestamp).getTime()
        if (dateTime === compDate) {
            bunch.pop()
            const time = new Date(bunch[0].timestamp).getTime()
            const timestamp = bunch[0].timestamp
            const open = bunch[0].floor_price_all === null ? bunch[1].floor_price_all : bunch[0].floor_price_all
            const close = data[i].floor_price_all === null ? bunch[bunch.length-1].floor_price_all : data[i].floor_price_all
            const {high, low} = getMinMax(bunch)
            let volume = volumes.find(o => o.time == compDate)
            console.log(data[i].timestamp, volume)
            // result.push({time, open, close, high, low, 'dateTime': timestamp})
            result.push({time, open, close, high, low, volume: volume === undefined || open === null || close === null ? null : volume.volume})
            compDate += PERIOD[interval]
            bunch = []
            bunch.push(data[i])
        }
    }
    return result || []
}

const handleVolumeData = (data, floorData, interval) => {
    console.log("handleVolumeData")
    let volumeData = []
    const startDate = Math.floor(new Date(floorData[0].timestamp).getTime()/PERIOD[interval])
    const date = startDate*PERIOD[interval]
    let compDate = date + PERIOD[interval]
    for (let i=0; i<data.dates.length; i++) {
        if (new Date(data.dates[i]).getTime() >= date && new Date(data.dates[i]).getTime() <= new Date(floorData[floorData.length-1].timestamp).getTime()) {
            volumeData.push({time: new Date(data.dates[i]).getTime(), dateTime: data.dates[i], volume: data.dataVolumeETH[i]})
        }
    }
    return volumeData || []
}

const handleLastKlinesData = (data, volumes, interval) => {
    console.log('handleLastKlinesData==>', data, interval)
    const time = data[0].timestamp
    const open = data[0].floor_price_all
    const close = data[data.length-1].floor_price_all
    const {high, low} = getMinMax(data)
    console.log({'time': new Date(time).getTime(), open, close, high, low, 'dateTime': time})
    return {'time': new Date(time).getTime(), open, close, high, low, volume: volumes[volumes.length-1].volume} || {}
}

const handleCandle = (klinesData ) => {
    const ohlc = []
    for (let i = 1; i < klinesData.length; i++) {
        const open = klinesData[i-1].floorPrice
        const close = klinesData[i].floorPrice
        const low = klinesData[i].min_price
        const high = klinesData[i].max_price
        const time = klinesData[i].time     // new Date(data[i].time).getTime()
        const volume = klinesData[i].volume
        ohlc.push({time, open, close, low, high, volume})
    }
    return ohlc
}

module.exports = {
    getData,
    setData,
    getHistoricalData,
    getLastKline,
    getVolumeData,
    handleKlinesData,
    handleLastKlinesData,
    handleVolumeData,
    handleCandle
}