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
};

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
      },
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      
      // Filter for PDF files for S3 upload
      const pdfFiles = newFiles.filter(file => file.type === "application/pdf");
      const otherFiles = newFiles.filter(file => file.type !== "application/pdf");
      
      // Add all files to regular attachments to maintain UI consistency
      setAttachments((prev) => [...prev, ...newFiles]);
      
      // Process PDF files for S3 upload
      for (const pdfFile of pdfFiles) {
        await handleS3Upload(pdfFile);
      }
    }
  };

  const handleS3Upload = async (file: File) => {
    if (!process.env.NEXT_PUBLIC_UPLOAD_API_URL) {
      console.error("Upload API URL not configured");
      return;
    }

    // Add file to upload statuses with pending status
    const newUpload: UploadStatus = { file, status: "pending" };
    setUploadStatuses(prev => [...prev, newUpload]);

    try {
      // Update status to uploading
      setUploadStatuses(prev => prev.map(upload => 
        upload.file.name === file.name ? { ...upload, status: "uploading" } : upload
      ));

      // Request pre-signed URL from API Gateway
      const response = await fetch(process.env.NEXT_PUBLIC_UPLOAD_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to get pre-signed URL: ${response.statusText}`);
      }

      const { uploadUrl, fileUrl } = await response.json();

      // Upload file directly to S3 using pre-signed URL
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload file: ${uploadResponse.statusText}`);
      }

      // Update status to success
      setUploadStatuses(prev => prev.map(upload => 
        upload.file.name === file.name ? { ...upload, status: "success" } : upload
      ));

      // Append S3 URL info to the file name in the attachments display
      const updatedAttachments = attachments.map(attachment => {
        if (attachment.name === file.name && attachment.type === "application/pdf") {
          // Create a new File object with modified name to indicate S3 upload
          return new File([attachment], attachment.name, { type: attachment.type });
        }
        return attachment;
      });
      setAttachments(updatedAttachments);

    } catch (error) {
      console.error("Error uploading file to S3:", error);
      setUploadStatuses(prev => prev.map(upload => 
        upload.file.name === file.name ? { 
          ...upload, 
          status: "error", 
          error: error instanceof Error ? error.message : "Unknown error" 
        } : upload
      ));
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

    // Create a message that includes information about attachments
    let messageText = input;
    if (!messageText.trim()) return;
    if (attachments.length > 0) {
      const fileNames = attachments.map((file) => file.name).join(", ");
      messageText += `\n[Attached files: ${fileNames}]`;
      
      // Add information about S3 uploaded PDFs
      const s3Files = uploadStatuses
        .filter(status => status.status === "success")
        .map(status => status.file.name);
      
      if (s3Files.length > 0) {
        messageText += `\n[S3 uploaded PDFs: ${s3Files.join(", ")}]`;
      }
    }

    // Create an array to store file data
    const fileData: { name: string; type: string; content: string }[] = [];

    // Read file contents
    if (attachments.length > 0) {
      await Promise.all(
        attachments.map(async (file) => {
          return new Promise<void>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const content = e.target?.result as string;
              fileData.push({
                name: file.name,
                type: file.type,
                content: content,
              });
              resolve();
            };
            reader.readAsDataURL(file);
          });
        })
      );
    }

    // Submit the message with file data
    handleSubmit(e, {
      data: {
        attachments: fileData,
      },
    });
    
    // Clear upload statuses after sending
    setUploadStatuses([]);
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
                  // Find if this file has an upload status (for PDFs)
                  const uploadStatus = uploadStatuses.find(
                    status => status.file.name === file.name && file.type === "application/pdf"
                  );
                  
                  // Determine status indicator component for PDFs
                  let statusIndicator = null;
                  if (uploadStatus) {
                    if (uploadStatus.status === "pending") {
                      statusIndicator = <span className="ml-1 text-blue-500">Preparing...</span>;
                    } else if (uploadStatus.status === "uploading") {
                      statusIndicator = <span className="ml-1 text-blue-500">Uploading...</span>;
                    } else if (uploadStatus.status === "success") {
                      statusIndicator = <span className="ml-1 text-green-500">✅ S3</span>;
                    } else if (uploadStatus.status === "error") {
                      statusIndicator = <span className="ml-1 text-red-500">❌ Failed</span>;
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
