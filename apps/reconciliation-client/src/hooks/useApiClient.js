import axios from 'axios'
import { useMemo } from 'react'

const client = axios.create({
  baseURL: '/api'
})

export function useApiClient () {
  return useMemo(() => ({
    get: client.get.bind(client),
    post: client.post.bind(client)
  }), [])
}
