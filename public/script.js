/*
 This is the frontend of the Local Legends app. It runs in the browser. 
 Fetches stories from MongoDB via the backend (NodeJS) 
 Builds "Info Windows" for Stories. 
 Gives User tools to add a new story (GMaps + input form)
 Posts new stories to MongoDB via NodeJS
 */

/* 
NOTE: there are two instances of Google maps. 
1. Story Map - shows nearby stories
2. Picker Map - lets you choose a location for a new story
*/

/* IMPORTANT: Explore the Google Maps documentation for further details and examples.
https://developers.google.com/maps/documentation/javascript/examples/infoWindow-simple */


/** You'll need to create an Id for each map in the Google Console
 * The purpose is not only to activate the map but to allow customization
 * for example you can create your own map styles and attach them to a specific mapId
 */
let pickerMapId = 'b7d6175c1f74d753'
let storyMapId = 'de53b62cae64ef23'

let pickerMap             /* Map to choose a location */
let pickerMarker          /* A draggable map marker used to pick a location */
let storyMap              /* Map for stories. */
let storyBounds           /* an area on the map big enough to fit all stories. */
let currentStory          /* keep track of which info-window is currently open.*/
let activeMarkers = []    /* keep track of the stories currently on the map. */
let editingStoryId = null /* track if we are editing an existing story */

/*  Function to initialize Google Maps 
Runs automatically via a callback after the Google Maps script loads. */
function initMap() {
  /* Here we ask the browser for the user's location.
  This involves a consent step. See also, MDN Documentation for the Geolocation API: 
  https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API 
  TODO: Ideally we would use a button to do this. */
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(position => {
      // express user's location in a form that Google Maps will understand
      let userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      }
      /* pass along the user's location to both maps */
      initializeStoryMap(userLocation)
      initializePickerMap(userLocation)
    })
  } else {
    // if the device lacks the ability to geolocate, show an info message.
    localLegends.innerHTML =
      `<main style="margin: 2rem auto text-align: center"> 
      <p><img src="/logo.svg" style="width:10rem"></p>
      <p>Local Legends requires a location-aware browser. </p>
    </main> `
  }
}

const initializeStoryMap = (userLocation) => {
  // center the Google map on the user's location 
  // make a new Google map to showing nearby stories.
  storyMap = new google.maps.Map(
    storyMapContainer,
    {
      center: userLocation,
      disableDefaultUI: true,
      mapId: pickerMapId
    }
  )
  // the storyBounds get extended whenever we add a point. 
  // here we are adding the user's location to initialize the storyBounds
  fetchStories(userLocation)
  // After the map tiles have finished loading,
  // Enable a Refresh button when Zooming or Panning
  google.maps.event.addListenerOnce(storyMap, 'tilesloaded', () => {
    google.maps.event.addListener(storyMap, 'zoom_changed', () => {
      refreshButton.style.display = 'block'
    })
    google.maps.event.addListener(storyMap, 'dragend', () => {
      refreshButton.style.display = 'block'
    })
  })
}

// the Picker map is used when creating a new story
// it allows us to pick a location for the new story.
const initializePickerMap = (userLocation) => {
  // the picker should be centered on the user Location. 
  // pickerMap will show UI for choosing a location for a new story
  pickerMap = new google.maps.Map(
    pickerMapContainer,
    {
      center: userLocation,
      zoom: 12,
      disableDefaultUI: true,
      mapId: storyMapId
    }
  )

  const pickerIcon = document.createElement('div');
  pickerIcon.className = 'create-icon'

  // make a new Google map for the purpose of picking a location
  pickerMarker = new google.maps.marker.AdvancedMarkerElement({
    position: userLocation,
    map: pickerMap,
    content: pickerIcon,
    draggable: true
  })
  // when dragging the marker, move the map to that spot
  google.maps.event.addListener(pickerMarker, 'dragend', (event) => {
    pickerMap.panTo(pickerMarker.getPosition())
    console.log(pickerMarker.position)
  })
  // when clicking the map, set the picker to the clicked location
  google.maps.event.addListener(pickerMap, 'click', (event) => {
    pickerMarker.position = event.latLng;
    pickerMap.panTo(pickerMarker.position)
  })
  //  When dragging the map, set the picker to the new map center.
  google.maps.event.addListener(pickerMap, 'dragend', () => {
    pickerMarker.position = pickerMap.getCenter();
    pickerMap.panTo(pickerMarker.position)
  })
}

// =======================================

/* Send a POST request to the "stories" endpoint. 
send along the  user's location as query parameters
NodeJS will use this data to query MongoDB for Stories */
const fetchStories = async (location) => {
  storyBounds = new google.maps.LatLngBounds()
  storyBounds.extend(location)
  try {
    const response = await fetch(
      `/api/stories?lat=${location.lat}&lng=${location.lng}`,
      { method: 'GET' }
    )
    const stories = await response.json()
    console.log(stories)

    if (stories.length === 0) {
      // If no stories, keep the map centered on the user's location
      storyMap.setCenter(location);
      storyMap.setZoom(12);
      console.log("No stories found. Displaying map centered on user's location.");
      return;
    }

    stories.forEach(story => mapStory(story))

    storyMap.fitBounds(storyBounds)
    refreshButton.style.display = 'none'
  } catch (err) {
    console.error(err)
  }
}

const niceDate = (dateString) => {
  let date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/* Delete a story by ID - for community moderation */
const deleteStory = async (storyId) => {
  if (confirm('Remove this story? This action cannot be undone.')) {
    try {
      const response = await fetch(`/api/story/${storyId}`, { method: 'DELETE' })
      const result = await response.json()
      console.log('Story deleted:', result)
      // Close the info window and refresh the map
      try { currentStory.close() } catch (e) { }
      resetMarkers()
      await fetchStories({
        lat: storyMap.getCenter().lat(),
        lng: storyMap.getCenter().lng()
      })
    } catch (err) {
      console.error('Error deleting story:', err)
    }
  }
}

/* Edit a story by ID - switches to create mode with pre-filled content */
const editStory = (storyId, currentContent, lng, lat) => {
  // Close the info window
  try { currentStory.close() } catch (e) { }
  // Set the editing state
  editingStoryId = storyId
  // Switch to create mode
  createMode()
  // Populate the form with existing content
  createText.value = currentContent
  // Set picker to the story's location
  const storyLocation = { lat, lng }
  pickerMap.setCenter(storyLocation)
  pickerMarker.position = storyLocation
}

/* Given a JSON object that describes a story, 
we are ready to add it to the map.*/
const mapStory = (story) => {
  /* Each story includes GPS coordinates.
  Here, we set up these coordinates in a way that Google understands. */
  let storyLocation = new google.maps.LatLng(
    story.location.coordinates[1],
    story.location.coordinates[0]
  )
  /* extend the storyBounds of the map to fit each new point */
  storyBounds.extend(storyLocation)
  /* Make an "infoWindow" for each story. 
  This is like a bubble that appears when we click on a marker.
  You could modify this template to show a variety of details. */
  let infoWindow = new google.maps.InfoWindow({
    maxWidth: 500,
    content: ` 
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <img src="bookmark.svg" style="width: 2rem; height: 2rem; margin-right: 20px;">
        <div style="margin-right: 1rem; margin-bottom: 1rem;">
          <p style="margin: 0px;">${story.content}</p>
          <p style="font-size: 0.8rem; color: #666; margin-top: 0.5rem;">
            ${story.createdAt ? niceDate(story.createdAt) : 'Date Unknown'}
          </p>
          <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
            <img src="edit.svg" onclick="editStory('${story._id}', '${story.content.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', ${story.location.coordinates[0]}, ${story.location.coordinates[1]})" style="width: 1.2rem; height: 1.2rem; cursor: pointer; opacity: 0.6;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">
            <img src="delete.svg" onclick="deleteStory('${story._id}')" style="width: 1.2rem; height: 1.2rem; cursor: pointer; opacity: 0.6;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">
          </div>
        </div>
      </div> 
    `
  })


  const storyIcon = document.createElement('div');
  storyIcon.className = 'story-icon'
  /* Markers are customizable with icons, etc.*/
  let marker = new google.maps.marker.AdvancedMarkerElement({
    position: storyLocation,
    map: storyMap,
    content: storyIcon
  })
  // Store the story ID on the marker for later lookup
  marker.storyId = story._id
  /* here we control what happens when the user clicks on a marker.*/
  marker.addListener("click", () => {
    /* if another window is already open, close it first*/
    try { currentStory.close() }
    catch (e) {  /* no window is open. */ }
    /* open the infoWindow attached to this marker. */
    infoWindow.open(storyMap, marker)
    /* set the infoWindow as "currentStory"
     this will allow us to track it and close it on subsequent clicks. */
    currentStory = infoWindow
    // If you want to center the map on the current marker,
    // Uncomment the following line:
    storyMap.panTo(marker.position)

  })
  // add the new marker to an array of active markers
  activeMarkers.push(marker)
}

// ==============================
// Below we activate/deactivate user interfaces
// by showing and hiding elements on the page

// Create Mode
// in create mode we see a picker map and a text input form
// The story map is hidden.
const createMode = () => {
  console.log('Switching to createMode')
  /* Reset the text area to be blank initially (unless editing). */
  if (!editingStoryId) {
    createText.value = ''
    /* Set the position of the picker map to match the storyMap. */
    pickerMap.setZoom(storyMap.getZoom())
    pickerMap.setCenter(storyMap.getCenter())
    pickerMarker.position = storyMap.getCenter();
  }
  /** Show and hide elements as needed */
  createButton.classList.add('active')
  mapButton.classList.remove('active')
  mapSection.style.display = "none"
  createSection.style.display = "block"
}

// Map Mode
// in map mode we see a map populated with stories. 
// The create map is hidden.
const mapMode = () => {
  console.log('Switching to mapMode')
  /** Show and hide elements as needed */
  createSection.style.display = "none"
  mapSection.style.display = "block"
  createButton.classList.remove('active')
  mapButton.classList.add('active')
}

// function to remove all the active markers
const resetMarkers = () => {
  activeMarkers.map(marker => marker.setMap(null))
  activeMarkers = [] // reset to a blank array.  
}

// event listeners for various buttons.
createButton.addEventListener('click', () => {
  editingStoryId = null  // Clear editing state when clicking Create button
  createMode()
})
mapButton.addEventListener('click', () => mapMode())


storyForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  /* Get the location of the picker */
  let { lat, lng } = pickerMarker.position;

  let json;

  if (editingStoryId) {
    /* Update existing story */
    const response = await fetch(`/api/story/${editingStoryId}`, {
      "method": "PUT",
      "headers": { 'Content-Type': 'application/json' },
      "body": JSON.stringify({
        "content": createText.value
      })
    })
    json = await response.json()
    console.log('Story updated:', json)
  } else {
    /* Create new story */
    const response = await fetch('/api/story', {
      "method": "POST",
      "headers": { 'Content-Type': 'application/json' },
      "body": JSON.stringify({
        "content": createText.value,
        "location": {
          "type": "Point",
          "coordinates": [lng, lat]
        }
      })
    })
    json = await response.json()
    console.log('Story created:', json)
  }

  const storyId = editingStoryId || json.status._id

  // Clear editing state
  editingStoryId = null

  mapMode()
  resetMarkers()
  // after creating/editing a story, refresh the map 
  // populate it with content nearby to the story's location
  await fetchStories({ lat, lng })
  storyMap.panTo({ lat, lng })
  // open the info window for the story
  const storyMarker = activeMarkers.find(marker => marker.storyId === storyId)
  if (storyMarker) {
    google.maps.event.trigger(storyMarker, 'click')
  }
})

// The refresh button clears the map and finds a new set of stories
// based on the current map center.
refreshButton.addEventListener('click', () => {
  // get center of map and run a new query. 
  resetMarkers()
  fetchStories({
    lat: storyMap.getCenter().lat(),
    lng: storyMap.getCenter().lng()
  })
})

