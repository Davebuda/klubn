#!/bin/bash

# DJ-DiP GraphQL API Test Script
# Tests critical GraphQL queries and mutations

BASE_URL="http://localhost:5000/graphql"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================"
echo "DJ-DiP GraphQL API Test Suite"
echo "================================"
echo ""

# Counter for results
PASSED=0
FAILED=0

# Function to test a GraphQL query
test_query() {
    local test_name=$1
    local query=$2
    local expected_field=$3

    echo -n "Testing: $test_name... "

    response=$(curl -s -X POST "$BASE_URL" \
        -H "Content-Type: application/json" \
        -d "{\"query\":\"$query\"}")

    if echo "$response" | grep -q "\"$expected_field\""; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED++))
        return 0
    elif echo "$response" | grep -q "\"errors\""; then
        echo -e "${RED}✗ FAILED${NC}"
        echo "Error: $(echo $response | python3 -m json.tool 2>/dev/null | grep -A 2 '"message"')"
        ((FAILED++))
        return 1
    else
        echo -e "${YELLOW}? UNKNOWN${NC}"
        ((FAILED++))
        return 1
    fi
}

echo "=== PUBLIC QUERIES ==="
echo ""

# Test 1: Landing Page Data
test_query "Landing Page" \
    "{ landing { events { id title } dJs { id stageName } } }" \
    "events"

# Test 2: Get All Events
test_query "Get All Events" \
    "{ events { id title date price } }" \
    "events"

# Test 3: Get All DJs
test_query "Get All DJs" \
    "{ dJs { id stageName bio genre } }" \
    "stageName"

# Test 4: Get Genres
test_query "Get Genres" \
    "{ genres { id name description } }" \
    "genres"

# Test 5: Get Venues
test_query "Get Venues" \
    "{ venues { id name city capacity } }" \
    "venues"

# Test 6: Get Services
test_query "Get Services" \
    "{ services { id name category basePrice } }" \
    "services"

# Test 7: Get Site Settings (ALL 74 FIELDS)
test_query "Get Site Settings" \
    "{ siteSettings { heroTitle heroSubtitle siteName siteLogoUrl primaryColor secondaryColor accentColor displayFont bodyFont siteDescription contactEmail facebookUrl instagramUrl showEventsSection showDJsSection footerText updatedAt } }" \
    "siteSettings"

# Test 8: Get Public Gallery
test_query "Get Public Gallery" \
    "{ publicGallery(skip: 0, take: 10) { id caption url userName uploadedAt } }" \
    "publicGallery"

# Test 9: Get Subscription Tiers
test_query "Get Subscription Tiers" \
    "{ subscriptionTiers { tier name monthlyPrice discountPercentage } }" \
    "subscriptionTiers"

echo ""
echo "=== DJ PROFILE TESTS ==="
echo ""

# Test 10: Get DJ with Social Media
test_query "Get DJ with Social Media" \
    "{ dJs { id stageName socialMedia { instagram facebook twitter tikTok youTube soundCloud spotify appleMusic beatport mixCloud website discord twitch } } }" \
    "socialMedia"

echo ""
echo "================================"
echo "Test Results Summary"
echo "================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo "Total: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Please review errors above.${NC}"
    exit 1
fi
