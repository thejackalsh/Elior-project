import React, { createContext, useContext, useState, useEffect } from 'react'
import { ImageSourcePropType } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type IconVariant = 'classic' | 'disco'

interface IconSources {
  preview: ImageSourcePropType
  splash:  ImageSourcePropType
}

export const ICON_VARIANTS: Record<IconVariant, IconSources> = {
  classic: {
    preview: require('../assets/app-icon.png'),
    splash:  require('../assets/app-icon.png'),
  },
  disco: {
    preview: require('../assets/app-icon.png'),
    splash:  require('../assets/app-icon.png'),
  },
}

const STORAGE_KEY = 'elior_icon_variant'

interface IconPreferenceContextValue {
  variant: IconVariant
  setVariant: (v: IconVariant) => void
  sources: IconSources
}

const IconPreferenceContext = createContext<IconPreferenceContextValue>(null!)

export function IconPreferenceProvider({ children }: { children: React.ReactNode }) {
  const [variant, setVariantState] = useState<IconVariant>('classic')

  // Load persisted preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'classic' || saved === 'disco') {
        setVariantState(saved)
      }
    })
  }, [])

  const setVariant = (v: IconVariant) => {
    setVariantState(v)
    AsyncStorage.setItem(STORAGE_KEY, v)
  }

  return (
    <IconPreferenceContext.Provider
      value={{ variant, setVariant, sources: ICON_VARIANTS[variant] }}
    >
      {children}
    </IconPreferenceContext.Provider>
  )
}

export const useIconPreference = () => useContext(IconPreferenceContext)
