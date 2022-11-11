import * as dotenv from 'dotenv'
import * as fs from 'fs'
import {Client} from "@googlemaps/google-maps-services-js"

dotenv.config()
const client = new Client({})

let data = "Name,Phone,Maps Link,Call Status"
let count = 0
let filteredCount = 0
let initLatLon = "49.2485485,-123.195839"
let API_KEY = process.env.GOOGLE_API_KEY

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

  console.log(`Found ${count} places in this area`)
  console.log(`Filtered and saved ${filteredCount} places`)
}

const main = async () => {
  let loopCount = 0
  let latlonArray = initLatLon.split(",")
  let initLat = latlonArray[0]
  let initLon = latlonArray[1]
  let latlon = initLatLon
  while (filteredCount < 150 && loopCount < 30) {
    await findIdealPlaces(latlon)
    if (loopCount % 10 === 9) {
      let latlonArray = latlon.split(",")
      let lat = parseFloat(latlonArray[0])
      lat += 0.01
      lat = lat.toString()
      latlon = lat + "," + initLon
    } else {
      let latlonArray = latlon.split(",")
      let lat = latlonArray[0]
      let lon = parseFloat(latlonArray[1])
      lon += 0.01
      lon = lon.toString()
      latlon = lat + "," + lon
    }
    console.log("Searching... " + latlon)
    loopCount++
  }
  fs.writeFileSync("data/FILE.CSV", data)
  console.log("CSV saved, terminating")
}
main()