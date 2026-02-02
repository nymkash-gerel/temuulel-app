'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ImageUploadProps {
  images: string[]
  onChange: (images: string[]) => void
  maxImages?: number
  storeId?: string
}

export default function ImageUpload({
  images,
  onChange,
  maxImages = 5,
  storeId
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const supabase = createClient()

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${storeId || 'temp'}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        return null
      }

      const { data } = supabase.storage
        .from('products')
        .getPublicUrl(fileName)

      return data.publicUrl
    } catch (err) {
      console.error('Upload failed:', err)
      return null
    }
  }

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const validFiles = fileArray.filter(file => {
      const isImage = file.type.startsWith('image/')
      const isValidSize = file.size <= 5 * 1024 * 1024 // 5MB
      return isImage && isValidSize
    })

    if (validFiles.length === 0) return

    const remainingSlots = maxImages - images.length
    const filesToUpload = validFiles.slice(0, remainingSlots)

    setUploading(true)

    const uploadPromises = filesToUpload.map(file => uploadImage(file))
    const results = await Promise.all(uploadPromises)
    const successfulUploads = results.filter((url): url is string => url !== null)

    if (successfulUploads.length > 0) {
      onChange([...images, ...successfulUploads])
    }

    setUploading(false)
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }, [images, maxImages, handleFiles])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files)
    }
  }

  const removeImage = async (index: number) => {
    const url = images[index]
    const newImages = images.filter((_, i) => i !== index)
    onChange(newImages)

    // Delete from Supabase Storage
    try {
      const match = url.match(/\/storage\/v1\/object\/public\/products\/(.+)$/)
      if (match) {
        await supabase.storage.from('products').remove([decodeURIComponent(match[1])])
      }
    } catch {
      // Image cleanup is best-effort
    }
  }

  const setMainImage = (index: number) => {
    if (index === 0) return
    const newImages = [...images]
    const [removed] = newImages.splice(index, 1)
    newImages.unshift(removed)
    onChange(newImages)
  }

  return (
    <div className="space-y-4">
      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {images.map((url, index) => (
            <div
              key={url}
              className={`relative aspect-square rounded-xl overflow-hidden border-2 ${
                index === 0 ? 'border-blue-500' : 'border-slate-600'
              }`}
            >
              <img
                src={url}
                alt={`Product ${index + 1}`}
                className="w-full h-full object-cover"
              />
              {index === 0 && (
                <div className="absolute top-2 left-2 px-2 py-1 bg-blue-500 text-white text-xs rounded-full">
                  Үндсэн
                </div>
              )}
              <div className="absolute top-2 right-2 flex gap-1">
                {index !== 0 && (
                  <button
                    type="button"
                    onClick={() => setMainImage(index)}
                    className="p-1.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-lg transition-all"
                    title="Үндсэн зураг болгох"
                  >
                    ⭐
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg transition-all"
                  title="Устгах"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Area */}
      {images.length < maxImages && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
            dragActive
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-slate-600 hover:border-slate-500'
          }`}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={uploading}
          />

          {uploading ? (
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-slate-400">Зураг байршуулж байна...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl">📷</span>
              </div>
              <p className="text-white font-medium mb-1">
                Зураг чирж оруулах эсвэл сонгох
              </p>
              <p className="text-slate-400 text-sm">
                PNG, JPG, WEBP (max 5MB)
              </p>
              <p className="text-slate-500 text-xs mt-2">
                {images.length}/{maxImages} зураг
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
