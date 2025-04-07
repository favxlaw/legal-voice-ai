"use client"

import { FiX, FiFileText, FiImage, FiFile, FiDatabase, FiPieChart } from "react-icons/fi"

interface FileAttachmentProps {
  file: File
  onRemove: () => void
}

export default function FileAttachment({ file, onRemove }: FileAttachmentProps) {
  // Function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B"
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB"
    else return (bytes / 1048576).toFixed(1) + " MB"
  }

  // Function to get the appropriate icon based on file type
  const getFileIcon = () => {
    const extension = file.name.split(".").pop()?.toLowerCase()

    if (["jpg", "jpeg", "png", "gif", "bmp", "svg"].includes(extension || "")) {
      return <FiImage className="text-purple-600" />
    } else if (["pdf", "doc", "docx", "txt", "rtf"].includes(extension || "")) {
      return <FiFileText className="text-purple-600" />
    } else if (["csv", "xlsx", "xls"].includes(extension || "")) {
      return <FiDatabase className="text-purple-600" />
    } else if (["ppt", "pptx"].includes(extension || "")) {
      return <FiPieChart className="text-purple-600" />
    } else {
      return <FiFile className="text-purple-600" />
    }
  }

  return (
    <div className="flex items-center gap-2 bg-white rounded-md border border-purple-200 py-1 px-3 text-sm">
      {getFileIcon()}
      <span className="truncate max-w-[150px]">{file.name}</span>
      <span className="text-gray-500 text-xs">({formatFileSize(file.size)})</span>
      <button type="button" onClick={onRemove} className="ml-1 text-gray-400 hover:text-gray-600">
        <FiX className="h-4 w-4" />
      </button>
    </div>
  )
}

