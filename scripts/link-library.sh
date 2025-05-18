#!/bin/bash
# Script to build, link and test the WFNodeServer library locally

# Set colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Building WFNodeServer library...${NC}"
yarn build

if [ $? -eq 0 ]; then
  echo -e "${GREEN}Build successful!${NC}"
else
  echo -e "${RED}Build failed. Exiting...${NC}"
  exit 1
fi

echo -e "${BLUE}Creating link for local development...${NC}"
yarn link

echo -e "${GREEN}Library linked successfully!${NC}"
echo ""
echo -e "${BLUE}Usage instructions:${NC}"
echo -e "1. Navigate to your project directory where you want to use this library"
echo -e "2. Run: ${GREEN}yarn link wfnodeserver${NC}"
echo -e "3. Import components in your code: ${GREEN}import { app, createServer } from 'wfnodeserver'${NC}"
echo ""
echo -e "${BLUE}To run tests on the library:${NC}"
echo -e "${GREEN}yarn test${NC}"
echo ""
echo -e "${BLUE}To run the example server:${NC}"
echo -e "${GREEN}yarn ts-node examples/basic-usage.ts${NC}"
echo ""
echo -e "${BLUE}When you're finished developing and want to unlink:${NC}"
echo -e "1. In your project directory: ${GREEN}yarn unlink wfnodeserver${NC}"
echo -e "2. In this directory: ${GREEN}yarn unlink${NC}"
