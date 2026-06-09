#!/bin/bash

echo "========================================="
echo "Image Upload & Gallery Media Test Script"
echo "========================================="
echo ""

BASE_URL="http://localhost:5000"
GRAPHQL_URL="$BASE_URL/graphql"
UPLOAD_URL="$BASE_URL/api/FileUpload/image"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test credentials
TEST_EMAIL="test@example.com"
TEST_PASSWORD="Test123!"

echo "Step 1: Register or Login User"
echo "--------------------------------"

# Try to register first
REGISTER_RESPONSE=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { register(input: { fullName: \"Test User\", email: \"'$TEST_EMAIL'\", password: \"'$TEST_PASSWORD'\" }) { accessToken user { id email fullName role } } }"
  }')

# Check if registration succeeded or if user already exists
if echo "$REGISTER_RESPONSE" | grep -q "accessToken"; then
  echo -e "${GREEN}✓ User registered successfully${NC}"
  TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
  USER_ID=$(echo "$REGISTER_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
else
  echo -e "${YELLOW}! User already exists, attempting login${NC}"

  # Try to login
  LOGIN_RESPONSE=$(curl -s -X POST "$GRAPHQL_URL" \
    -H "Content-Type: application/json" \
    -d '{
      "query": "mutation { login(input: { email: \"'$TEST_EMAIL'\", password: \"'$TEST_PASSWORD'\" }) { accessToken user { id email fullName role } } }"
    }')

  if echo "$LOGIN_RESPONSE" | grep -q "accessToken"; then
    echo -e "${GREEN}✓ User logged in successfully${NC}"
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
    USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
  else
    echo -e "${RED}✗ Login failed${NC}"
    echo "$LOGIN_RESPONSE"
    exit 1
  fi
fi

echo "Token: ${TOKEN:0:50}..."
echo "User ID: $USER_ID"
echo ""

echo "Step 2: Create Test Image"
echo "-------------------------"

# Create a simple test image using ImageMagick or just a placeholder
TEST_IMAGE_PATH="/tmp/test_upload_$(date +%s).png"

# Create a simple 100x100 pixel PNG (using base64 encoded 1x1 pixel PNG and writing it)
# This is a minimal valid PNG file
printf '\x89\x50\x4E\x47\x0D\x0A\x1A\x0A\x00\x00\x00\x0D\x49\x48\x44\x52\x00\x00\x00\x64\x00\x00\x00\x64\x08\x02\x00\x00\x00\xFF\x80\x02\x03\x00\x00\x00\x19\x49\x44\x41\x54\x78\x9C\xED\xC1\x01\x0D\x00\x00\x00\xC2\xA0\xF7\x4F\x6D\x0E\x37\xA0\x00\x00\x00\x00\x00\x00\x00\x00\xBE\x0D\x21\x00\x00\x01\x9A\x60\xE1\xD5\x00\x00\x00\x00\x49\x45\x4E\x44\xAE\x42\x60\x82' > "$TEST_IMAGE_PATH"

if [ -f "$TEST_IMAGE_PATH" ]; then
  echo -e "${GREEN}✓ Test image created: $TEST_IMAGE_PATH${NC}"
else
  echo -e "${RED}✗ Failed to create test image${NC}"
  exit 1
fi
echo ""

echo "Step 3: Upload Image via API"
echo "----------------------------"

UPLOAD_RESPONSE=$(curl -s -X POST "$UPLOAD_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TEST_IMAGE_PATH" \
  -F "folder=gallery")

echo "Upload Response:"
echo "$UPLOAD_RESPONSE"
echo ""

if echo "$UPLOAD_RESPONSE" | grep -q "url"; then
  echo -e "${GREEN}✓ Image uploaded successfully${NC}"
  IMAGE_URL=$(echo "$UPLOAD_RESPONSE" | grep -o '"url":"[^"]*' | cut -d'"' -f4)
  echo "Image URL: $IMAGE_URL"
else
  echo -e "${RED}✗ Image upload failed${NC}"
  echo "Response: $UPLOAD_RESPONSE"

  # Check if it's an auth issue
  if echo "$UPLOAD_RESPONSE" | grep -q "401\|403\|Unauthorized\|Forbidden"; then
    echo -e "${YELLOW}! This appears to be an authentication/authorization issue${NC}"
  fi

  # Clean up and exit
  rm -f "$TEST_IMAGE_PATH"
  exit 1
fi
echo ""

echo "Step 4: Create Gallery Media Entry via GraphQL"
echo "----------------------------------------------"

GALLERY_RESPONSE=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "mutation { createGalleryMedia(input: { title: \"Test Upload\", description: \"Testing image upload functionality\", mediaUrl: \"'$IMAGE_URL'\", mediaType: \"image\" }) }"
  }')

echo "Gallery Response:"
echo "$GALLERY_RESPONSE"
echo ""

if echo "$GALLERY_RESPONSE" | grep -q "createGalleryMedia"; then
  echo -e "${GREEN}✓ Gallery media entry created successfully${NC}"
  MEDIA_ID=$(echo "$GALLERY_RESPONSE" | grep -o '"createGalleryMedia":"[^"]*' | cut -d'"' -f4)
  echo "Media ID: $MEDIA_ID"
else
  echo -e "${RED}✗ Failed to create gallery media entry${NC}"

  # Check for specific errors
  if echo "$GALLERY_RESPONSE" | grep -q "authenticated"; then
    echo -e "${YELLOW}! Authentication error - token might not be working properly${NC}"
  fi
fi
echo ""

echo "Step 5: Fetch Gallery Media"
echo "---------------------------"

FETCH_RESPONSE=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { galleryMedia(approvedOnly: false) { id title description mediaUrl userId isApproved isFeatured } }"
  }')

echo "Fetch Response:"
echo "$FETCH_RESPONSE" | head -c 500
echo ""

if echo "$FETCH_RESPONSE" | grep -q "galleryMedia"; then
  echo -e "${GREEN}✓ Gallery media fetched successfully${NC}"

  # Count items
  ITEM_COUNT=$(echo "$FETCH_RESPONSE" | grep -o '"id"' | wc -l)
  echo "Found $ITEM_COUNT gallery items"
else
  echo -e "${RED}✗ Failed to fetch gallery media${NC}"
fi
echo ""

echo "Cleanup"
echo "-------"
rm -f "$TEST_IMAGE_PATH"
echo -e "${GREEN}✓ Temporary files cleaned up${NC}"
echo ""

echo "========================================="
echo "Test Complete!"
echo "========================================="
