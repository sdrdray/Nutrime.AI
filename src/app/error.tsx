'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to the console
    console.error('Application Error:', error)
    console.error('Error Stack:', error.stack)
    console.error('Error Digest:', error.digest)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 max-w-2xl">
        <strong className="font-bold">Error:</strong>
        <span className="block sm:inline"> {error.message}</span>
        {error.digest && (
          <div className="mt-2">
            <strong>Digest:</strong> {error.digest}
          </div>
        )}
      </div>
      <button
        onClick={reset}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        Try again
      </button>
    </div>
  )
}
