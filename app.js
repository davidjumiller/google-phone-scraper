import * as dotenv from 'dotenv'
import * as fs from 'fs'
import { argv } from 'node:process'
import { Client } from "@googlemaps/google-maps-services-js"

dotenv.config()
const client = new Client({})

let data = "Name,Phone,Maps Link,Call Status"
let initLatLon = argv[2]? argv[2] : "49.2455641,-123.0911558"
let maxRows = argv[3]? parseInt(argv[3]) : 10
let API_KEY = process.env.GOOGLE_API_KEY
let count = 0
let filteredCount = 0

const getPlacesNearby = async (location, radius, nextPage, key) => {
  try {
    let request = {
      params: {
        location: location,
        radius: radius,
        key: key
      }
    }
    if (nextPage) {
      request.params['pagetoken'] = nextPage

      /**
       * According to the places api source code, there is a short delay between
       * when a 'next_page_token' is issued, and when it will become valid.
       * We must set a short delay before checking next pages
       */
      const waitForToken = (delay) => new Promise(resolve => {
        setTimeout(() => resolve(client.placesNearby(request)), delay)
      })
      return await waitForToken(1000)
    } else {
      return await client.placesNearby(request)
    }
  } catch (e) {
    console.log("Error: " + e.response.data.error_message)
  }
}

const getPlaceDetails = async (id, key) => {
  try {
    return await client.placeDetails({
      params: {
        place_id: id,
        key: key
      }
    })
  } catch (e) {
    console.log("Error: " +  e.response.data.error_message)
  }
}

const findIdealPlaces = async (latlon) => {
  let nextPageToken = null
  do {
    let res = await getPlacesNearby(latlon, 700, nextPageToken, API_KEY)
    if (!res) break
    const results = res.data.results
    nextPageToken = res.data.next_page_token? res.data.next_page_token : null
    count += results.length

    for (const place of results) {
      if (place.business_status !== 'OPERATIONAL' || place.user_ratings_total < 4 || !place.user_ratings_total) continue
      const name = place.name
      const id = place.reference

      const placeDetails = await getPlaceDetails(id, API_KEY)
      const website = placeDetails.data.result.website
      const phone = placeDetails.data.result.formatted_phone_number
      const url = placeDetails.data.result.url

      if (!website && phone) {
        data += `\r\n${name},${phone},${url}`
        filteredCount++
      }
    }
  } while (nextPageToken)

  console.log(`Found ${count} places in this area so far`)
  console.log(`Filtered and saved ${filteredCount} places total`)
}

const updateLatLon = (loopCount, latlon) => {
  let searchAreaWidth = Math.floor(Math.sqrt(maxRows))
  let latlonArray = latlon.split(",")
  let lat = parseFloat(latlonArray[0])
  let lon = parseFloat(latlonArray[1])
  if (loopCount % searchAreaWidth === searchAreaWidth-1) {
    lat += 0.01
    lat = lat.toString()
    let initLon = initLatLon.split(",")[1]
    return lat + "," + initLon
  } else {
    lon += 0.01
    lon = lon.toString()
    return lat + "," + lon
  }
}

const main = async () => {
  let loopCount = 0
  let latlon = initLatLon
  while (filteredCount < maxRows && loopCount < maxRows) {
    await findIdealPlaces(latlon)
    latlon = updateLatLon(loopCount, latlon)
    console.log("Searching... " + latlon)
    loopCount++
  }
  fs.writeFileSync("data/FILE.CSV", data)
  console.log("CSV saved, terminating")
}
main()