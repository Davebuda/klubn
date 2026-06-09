#!/bin/bash

echo "========================================"
echo "Event Creation Test Script"
echo "========================================"
echo ""

BASE_URL="http://localhost:5000"
GRAPHQL_URL="$BASE_URL/graphql"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test data from database
VENUE_ID="FCCCA386-0BA2-47BD-9228-99AAE2C0C6E4"
DJ_ID_1="5630A699-C35A-4B56-A866-6A71F7C7FCCF"
DJ_ID_2="A0399B2A-D04D-4AA4-8731-2689773D256B"
GENRE_ID_1="737131F8-9EAD-475C-ABEA-36530EDDEA4B"
GENRE_ID_2="CE12D30E-DB9D-4564-9080-669BE4A0913C"

echo "Step 1: Create Test Event"
echo "-------------------------"

EVENT_DATE=$(date -u -v+7d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "+7 days" +"%Y-%m-%dT%H:%M:%SZ")

CREATE_RESPONSE=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { createEvent(input: { title: \"Test Event - '$(date +%s)'\", date: \"'$EVENT_DATE'\", venueId: \"'$VENUE_ID'\", price: 25.99, description: \"Testing event creation functionality\", genreIds: [\"'$GENRE_ID_1'\", \"'$GENRE_ID_2'\"], djIds: [\"'$DJ_ID_1'\", \"'$DJ_ID_2'\"], imageUrl: \"http://localhost:5000/uploads/test-event.png\" }) }"
  }')

echo "Create Response:"
echo "$CREATE_RESPONSE"
echo ""

if echo "$CREATE_RESPONSE" | grep -q "createEvent"; then
  if echo "$CREATE_RESPONSE" | grep -q "errors"; then
    echo -e "${RED}✗ Event creation failed with errors${NC}"
    echo "$CREATE_RESPONSE" | grep -o '"message":"[^"]*"' | cut -d'"' -f4
    exit 1
  else
    echo -e "${GREEN}✓ Event created successfully${NC}"
    EVENT_ID=$(echo "$CREATE_RESPONSE" | grep -o '"createEvent":"[^"]*' | cut -d'"' -f4)
    echo "Event ID: $EVENT_ID"
  fi
else
  echo -e "${RED}✗ Event creation failed${NC}"

  # Check for specific error messages
  if echo "$CREATE_RESPONSE" | grep -q "FOREIGN KEY"; then
    echo -e "${YELLOW}! Foreign key constraint error - VenueId or DJId might be invalid${NC}"
  elif echo "$CREATE_RESPONSE" | grep -q "constraint"; then
    echo -e "${YELLOW}! Database constraint error${NC}"
  fi

  exit 1
fi
echo ""

echo "Step 2: Fetch Created Event"
echo "---------------------------"

FETCH_RESPONSE=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { event(id: \"'$EVENT_ID'\") { id title description date price venue { id name city } } }"
  }')

echo "Fetch Response:"
echo "$FETCH_RESPONSE"
echo ""

if echo "$FETCH_RESPONSE" | grep -q '"event"'; then
  echo -e "${GREEN}✓ Event fetched successfully${NC}"

  # Extract and display event details
  TITLE=$(echo "$FETCH_RESPONSE" | grep -o '"title":"[^"]*' | head -1 | cut -d'"' -f4)
  VENUE_NAME=$(echo "$FETCH_RESPONSE" | grep -o '"name":"[^"]*' | head -1 | cut -d'"' -f4)

  echo "Event Title: $TITLE"
  echo "Venue: $VENUE_NAME"
else
  echo -e "${RED}✗ Failed to fetch event${NC}"
fi
echo ""

echo "Step 3: List All Events"
echo "----------------------"

LIST_RESPONSE=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { events { id title date venue { name } } }"
  }')

if echo "$LIST_RESPONSE" | grep -q "$EVENT_ID"; then
  echo -e "${GREEN}✓ New event appears in events list${NC}"

  EVENT_COUNT=$(echo "$LIST_RESPONSE" | grep -o '"id"' | wc -l)
  echo "Total events in database: $EVENT_COUNT"
else
  echo -e "${YELLOW}! New event not found in events list${NC}"
fi
echo ""

echo "========================================"
echo "Test Complete!"
echo "========================================"
