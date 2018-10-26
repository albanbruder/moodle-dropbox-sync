import 'dotenv/config'
import Promise from 'bluebird'
import { TaskQueue } from 'cwait'
import moment from 'moment'
import Moodle from 'node-moodle-scraper'
import fetch from 'node-fetch'
import { Dropbox } from 'dropbox'

/**
 * Writes timestamp and message to the console.
 * @param {string} message
 * @param  {...any} optionalParams
 */
const log = (message, ...optionalParams) => {
  const now = new Date()
  const timestamp = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`
  console.log(`[${timestamp}]`, message, ...optionalParams)
}

/**
 * Main Script
 */
;(async () => {
  const moodleUrl = process.env.MOODLE_URL.trim('/')
  const moodleUsername = process.env.MOODLE_USERNAME
  const moodlePassword = process.env.MOODLE_PASSWORD

  const dropboxSyncPath = process.env.DROPBOX_SYNC_PATH
  const dropboxAccessToken = process.env.DROPBOX_ACCESS_TOKEN

  const dbx = new Dropbox({
    accessToken: dropboxAccessToken,
    fetch: fetch
  })

  const moodle = new Moodle({
    baseUrl: moodleUrl
  })

  const loggedIn = await moodle
    .login({
      username: moodleUsername,
      password: moodlePassword
    })
    .catch(error => {
      console.log(error)
    })

  if (loggedIn) {
    log(`Successfull logged in with username ${moodleUsername}`)
  } else {
    log('Login failed')
    return
  }

  // Save the start time of the synchronization process.
  const timerStart = new Date()

  // Fetch courses.
  const courses = await moodle.getCourses()
  log(`${courses.length} courses fetched from ${moodleUrl}`)

  let resourcesToSync = []

  for (const course of courses) {
    log(`Fetching resources for course '${course.getName()}'`)
    const sections = await course.getSections()

    const sectionsQueue = new TaskQueue(Promise, 5)
    await Promise.map(
      sections,
      sectionsQueue.wrap(async section => {
        const resources = await section.getResources()

        // Ignore this section if there are no resources
        if (resources.length <= 0) {
          return
        }

        const resourcesQueue = new TaskQueue(Promise, 20)
        await Promise.map(
          resources,
          resourcesQueue.wrap(async resource => {
            const filepath = `${dropboxSyncPath}/${course.getName()}/${section.getName()}/${resource.getFilename()}`
            const header = await resource.getHeader()

            // Check if file exists in Dropbox
            const dropboxMeta = await dbx
              .filesGetMetadata({
                path: filepath
              })
              .catch(() => null)
            if (
              !!dropboxMeta &&
              dropboxMeta.size !== Number(header['Content-Length'])
            ) {
              return
            }

            resourcesToSync.push({
              resource,
              filepath
            })
          })
        )
      })
    )
  }

  /**
   * Download and upload resources to dropbox.
   */
  let syncCount = 0

  const syncQueue = new TaskQueue(Promise, 3)
  await Promise.map(
    resourcesToSync,
    syncQueue.wrap(async ({ resource, filepath }) => {
      log(`Downloading: ${resource.getFilename()}`)
      const buffer = await resource.download()

      log(`Uploading ${resource.getFilename()} to Dropbox`)
      await dbx
        .filesUpload({
          path: filepath,
          contents: buffer,
          mode: {
            '.tag': 'overwrite'
          },
          autorename: false
        })
        .then(() => {
          syncCount++
        })
        .catch(error => console.error(error))
    })
  )

  // Calculate and display final message.
  if (syncCount > 0) {
    const timerEnd = moment()
    const time = timerEnd.diff(timerStart, 'seconds')
    log(`${syncCount} files downloaded in ${time} seconds.`)
  } else {
    log('Nothing to download. All files are up to date.')
  }
})()
