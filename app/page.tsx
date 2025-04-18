"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { FiSend, FiPaperclip, FiFileText } from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ChatHeader from "@/components/chat-header";
import ChatMessage from "@/components/chat-message";
import FileAttachment from "@/components/file-attachment";

// Status types for file upload
type UploadStatus = {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  fileUrl?: string; // Added to store the S3 file URL
};

// Maximum allowed file size in bytes (e.g., 10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed file types
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "text/plain",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv"
];

export default function Home() {
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: "/api/chat",
      onFinish: () => {
        // Clear attachments after sending
        setAttachments([]);
        // Clear upload statuses after sending
        setUploadStatuses([]);
      },
    });

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return { 
        valid: false, 
        error: `File size exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` 
      };
    }
    
    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return { 
        valid: false, 
        error: "File type not supported" 
      };
    }
    
    return { valid: true };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      
      // Validate each file before adding
      const validFiles: File[] = [];
      
      newFiles.forEach(file => {
        const validation = validateFile(file);
        if (validation.valid) {
          validFiles.push(file);
          // Add the file with pending status
          setUploadStatuses(prev => [
            ...prev, 
            { 
              file, 
              status: "pending"
            }
          ]);
        } else {
          // Add the file with error status
          setUploadStatuses(prev => [
            ...prev, 
            { 
              file, 
              status: "error", 
              error: validation.error 
            }
          ]);
        }
      });
      
      setAttachments(prev => [...prev, ...validFiles]);
    }
  };

  const handleS3Upload = async (file: File) => {
    if (!process.env.NEXT_PUBLIC_UPLOAD_API_URL) {
      console.error("Upload API URL not configured");
      return { success: false, error: "Upload API URL not configured" };
    }

    try {
      // Update status to uploading
      setUploadStatuses(prev => {
        const existingStatus = prev.find(status => status.file.name === file.name);
        if (existingStatus) {
          return prev.map(status => 
            status.file.name === file.name ? { ...status, status: "uploading" } : status
          );
        } else {
          return [...prev, { file, status: "uploading" }];
        }
      });

      // Request pre-signed URL from API Gateway
      const response = await fetch(process.env.NEXT_PUBLIC_UPLOAD_API_URL, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          // Add any authentication headers here if needed
        },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type
        })
        //credentials: "include" // Include cookies if using session authentication
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get pre-signed URL: ${response.status} ${errorText}`);
      }

      const { uploadUrl, fileUrl } = await response.json();
      
      if (!uploadUrl) {
        throw new Error("No upload URL provided by server");
      }

      // Upload file directly to S3 using pre-signed URL
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload file: ${uploadResponse.status} ${await uploadResponse.text()}`);
      }

      // Update status to success
      setUploadStatuses(prev => prev.map(status => 
        status.file.name === file.name ? { 
          ...status, 
          status: "success",
          fileUrl: fileUrl
        } : status
      ));

      return { success: true, fileUrl };

    } catch (error) {
      console.error("Error uploading file to S3:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      setUploadStatuses(prev => {
        const existingStatus = prev.find(status => status.file.name === file.name);
        if (existingStatus) {
          return prev.map(status => 
            status.file.name === file.name ? { 
              ...status, 
              status: "error", 
              error: errorMessage
            } : status
          );
        } else {
          return [...prev, { 
            file, 
            status: "error", 
            error: errorMessage
          }];
        }
      });
      
      return { success: false, error: errorMessage };
    }
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const removeAttachment = (index: number) => {
    const fileToRemove = attachments[index];
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    
    // Also remove from upload statuses if it exists there
    setUploadStatuses(prev => prev.filter(status => status.file.name !== fileToRemove.name));
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Don't proceed if there's no input text and no attachments
    if (!input.trim() && attachments.length === 0) return;

    // Don't modify the user's input text - keep it as is
    // We'll handle uploaded files separately in the data object
    
    // Upload any files that haven't been uploaded yet
    const pendingFiles = attachments.filter(file => {
      const status = uploadStatuses.find(s => s.file.name === file.name);
      return !status || status.status === "pending" || status.status === "error";
    });
    
    // Upload files to S3 first
    const uploadResults = await Promise.all(
      pendingFiles.map(async (file) => {
        const result = await handleS3Upload(file);
        return { 
          file, 
          success: result.success, 
          fileUrl: result.fileUrl,
          error: result.error
        };
      })
    );
    
    // Create an array to store file data for all attachments
    const fileData = attachments.map(file => {
      // Check if we just uploaded this file
      const uploadResult = uploadResults.find(result => result.file.name === file.name);
      
      // Check if this file was previously uploaded
      const existingStatus = uploadStatuses.find(status => 
        status.file.name === file.name && status.status === "success"
      );
      
      return {
        name: file.name,
        type: file.type,
        url: uploadResult?.fileUrl || existingStatus?.fileUrl
      };
    }).filter(file => file.url); // Only include files that have a URL
    
    // Submit the message with file data
    handleSubmit(e, {
      data: {
        attachments: fileData,
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      const formEvent = new Event("submit", {
        bubbles: true,
        cancelable: true,
      }) as unknown as React.FormEvent<HTMLFormElement>;
      onSubmit(formEvent);
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col min-h-screen bg-ocean-light">
      <ChatHeader />

      <main className="flex-1 container max-w-4xl mx-auto p-4 flex flex-col">
        <Card className="flex-1 flex flex-col overflow-hidden shadow-lg border-purple-200 bg-ocean-darker">
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-3">
                  <div className="bg-purple-100 p-4 rounded-full inline-block">
                    <FiFileText className="h-8 w-8 text-ocean-darker" />
                  </div>
                  <h2 className="text-2xl font-semibold text-ocean-lightest">
                    Welcome to Insight Analyzer
                  </h2>
                  <p className="text-ocean-light max-w-md">
                    I'm your AI assistant. Upload documents or ask questions to
                    get started.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-purple-100 p-4">
            {attachments.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachments.map((file, index) => {
                  // Find if this file has an upload status
                  const uploadStatus = uploadStatuses.find(
                    status => status.file.name === file.name
                  );
                  
                  // Determine status indicator component
                  let statusIndicator = null;
                  if (uploadStatus) {
                    if (uploadStatus.status === "pending") {
                      statusIndicator = <span className="ml-1 text-blue-500">Pending</span>;
                    } else if (uploadStatus.status === "uploading") {
                      statusIndicator = <span className="ml-1 text-blue-500">Uploading...</span>;
                    } else if (uploadStatus.status === "success") {
                      statusIndicator = <span className="ml-1 text-green-500">✅ Uploaded</span>;
                    } else if (uploadStatus.status === "error") {
                      statusIndicator = (
                        <span className="ml-1 text-red-500" title={uploadStatus.error || "Error"}>
                          ❌ Failed
                        </span>
                      );
                    }
                  }
                  
                  return (
                    <div key={index} className="flex items-center">
                      <FileAttachment
                        file={file}
                        onRemove={() => removeAttachment(index)}
                      />
                      {statusIndicator}
                    </div>
                  );
                })}
              </div>
            )}

            <form onSubmit={onSubmit} className="flex items-end gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.csv,.xlsx,.xls,.ppt,.pptx"
                multiple
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAttachmentClick}
                className="flex-shrink-0 -translate-y-6"
              >
                <FiPaperclip className="h-5 w-5" />
              </Button>

              <div className="relative flex-1">
                <div className="w-full">
                  <textarea
                    className="w-full rounded-md border border-ocean-lightest focus:border-ocean-light focus:ring focus:ring-ocean-light focus:ring-opacity-50 pl-3 pr-10 py-2 resize-none min-h-[50px] max-h-[150px] bg-ocean-light text-ocean-darker"
                    placeholder="Type your question..."
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    style={{ height: "auto" }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = "auto";
                      target.style.height = `${Math.min(
                        target.scrollHeight,
                        150
                      )}px`;
                    }}
                  />
                  <div className="text-xs text-ocean-lightest mt-1 text-right">
                    Press Ctrl+Enter to send
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="flex-shrink-0 bg-ocean-light hover:bg-ocean-dark -translate-y-6 text-ocean-darker"
                disabled={
                  isLoading || (!input.trim() && attachments.length === 0)
                }
              >
                <FiSend className="h-5 w-5" />
              </Button>
            </form>
          </div>
        </Card>
      </main>
    </div>
  );
}
