import { pushable } from 'it-pushable'

const stream = pushable<string>({ objectMode: true })

;(async () => {
  for await (const chunk of stream) {
    console.log(chunk)
  }
})()

stream.push('a')
stream.push('b')
stream.push('c')
stream.end()
stream.end()
stream.push('a')
stream.push('b')
stream.push('c')

setTimeout(() => {
  console.log('end')
}, 50)

