// Test setup: adds the jest-dom matchers (toBeInTheDocument and friends) and unmounts rendered components after every test.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
