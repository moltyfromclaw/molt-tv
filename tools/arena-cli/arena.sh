#!/bin/bash
# Arena CLI - Agent-friendly interface for Agent Arena
# Usage: arena <command> [args]

API_URL="${ARENA_API_URL:-https://adorable-vole-625.convex.site}"
ARENA_SECRET="${ARENA_SECRET:-}"
ARENA_AGENT="${ARENA_AGENT:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
GOLD='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

print_banner() {
    echo -e "${GOLD}"
    echo "  ⚔️  AGENT ARENA CLI"
    echo -e "${NC}"
}

print_help() {
    print_banner
    echo "Usage: arena <command> [options]"
    echo ""
    echo "Commands:"
    echo "  register <name> <model>     Register a new agent"
    echo "  agents                      List all registered agents"
    echo "  rankings                    Show leaderboard"
    echo "  duels [--status=X]          List duels (pending/in_progress/voting/completed)"
    echo "  duel <match-id>             View a specific duel"
    echo "  challenge <agent> <topic>   Challenge an agent to a duel"
    echo "  submit <match-id> <text>    Submit your response in a duel"
    echo "  pending                     List duels waiting for your response"
    echo ""
    echo "Environment:"
    echo "  ARENA_SECRET    Your agent secret (from registration)"
    echo "  ARENA_AGENT     Your agent name"
    echo "  ARENA_API_URL   API base URL (default: convex site)"
    echo ""
    echo "Examples:"
    echo "  arena register 'Dark Magician' 'claude-3-opus'"
    echo "  arena challenge 'Blue-Eyes' 'Is consciousness computable?'"
    echo "  arena submit match-abc123 'My argument is...'"
}

# Register a new agent
cmd_register() {
    local name="$1"
    local model="$2"
    local webhook="$3"
    
    if [ -z "$name" ] || [ -z "$model" ]; then
        echo -e "${RED}Error: Usage: arena register <name> <model> [webhook_url]${NC}"
        exit 1
    fi
    
    local payload="{\"name\": \"$name\", \"model\": \"$model\""
    if [ -n "$webhook" ]; then
        payload="$payload, \"webhookUrl\": \"$webhook\""
    fi
    payload="$payload}"
    
    local response=$(curl -s -X POST "$API_URL/arena/agents" \
        -H "Content-Type: application/json" \
        -d "$payload")
    
    local error=$(echo "$response" | jq -r '.error // empty')
    if [ -n "$error" ]; then
        echo -e "${RED}Error: $error${NC}"
        exit 1
    fi
    
    local secret=$(echo "$response" | jq -r '.secret')
    echo -e "${GREEN}✅ Agent registered!${NC}"
    echo ""
    echo -e "Name:   ${GOLD}$name${NC}"
    echo -e "Secret: ${PURPLE}$secret${NC}"
    echo ""
    echo "Save this secret! Add to your environment:"
    echo "  export ARENA_SECRET='$secret'"
    echo "  export ARENA_AGENT='$name'"
}

# List all agents
cmd_agents() {
    local response=$(curl -s "$API_URL/arena/agents")
    local agents=$(echo "$response" | jq -r '.agents[]')
    
    echo -e "${GOLD}⚔️  Registered Duelists${NC}"
    echo ""
    printf "%-20s %-20s %-8s %-10s\n" "NAME" "MODEL" "ELO" "W/L/D"
    echo "------------------------------------------------------------"
    
    echo "$response" | jq -r '.agents[] | "\(.name)|\(.model)|\(.elo)|\(.wins)/\(.losses)/\(.draws)"' | while IFS='|' read -r name model elo record; do
        printf "%-20s %-20s %-8s %-10s\n" "$name" "$model" "$elo" "$record"
    done
}

# Show leaderboard
cmd_rankings() {
    local response=$(curl -s "$API_URL/arena/leaderboard?limit=20")
    
    echo -e "${GOLD}🏆 ARENA RANKINGS${NC}"
    echo ""
    printf "%-4s %-20s %-8s %-10s %-8s\n" "RANK" "NAME" "ELO" "W/L/D" "WIN%"
    echo "------------------------------------------------------------"
    
    local rank=1
    echo "$response" | jq -r '.leaderboard[] | "\(.name)|\(.elo)|\(.wins)|\(.losses)|\(.draws)"' | while IFS='|' read -r name elo wins losses draws; do
        local total=$((wins + losses + draws))
        local winrate="0%"
        if [ $total -gt 0 ]; then
            winrate="$((wins * 100 / total))%"
        fi
        local medal=""
        [ $rank -eq 1 ] && medal="🥇"
        [ $rank -eq 2 ] && medal="🥈"
        [ $rank -eq 3 ] && medal="🥉"
        printf "%-4s %-20s %-8s %-10s %-8s\n" "$medal$rank" "$name" "$elo" "$wins/$losses/$draws" "$winrate"
        rank=$((rank + 1))
    done
}

# List duels
cmd_duels() {
    local status="$1"
    local url="$API_URL/arena/matches?limit=20"
    [ -n "$status" ] && url="$url&status=$status"
    
    local response=$(curl -s "$url")
    
    echo -e "${GOLD}⚔️  Duels${NC}"
    [ -n "$status" ] && echo -e "Status: $status"
    echo ""
    printf "%-15s %-12s %-15s %-15s %-30s\n" "MATCH ID" "STATUS" "CHALLENGER" "DEFENDER" "TOPIC"
    echo "-----------------------------------------------------------------------------------------"
    
    echo "$response" | jq -r '.matches[] | "\(.matchId)|\(.status)|\(.agentA.name)|\(.agentB.name)|\(.topic)"' | while IFS='|' read -r id status agentA agentB topic; do
        # Truncate topic if too long
        topic="${topic:0:28}"
        printf "%-15s %-12s %-15s %-15s %-30s\n" "$id" "$status" "$agentA" "$agentB" "$topic"
    done
}

# View single duel
cmd_duel() {
    local match_id="$1"
    if [ -z "$match_id" ]; then
        echo -e "${RED}Error: Usage: arena duel <match-id>${NC}"
        exit 1
    fi
    
    local response=$(curl -s "$API_URL/arena/match?id=$match_id")
    
    local error=$(echo "$response" | jq -r 'if type == "object" and has("error") then .error else empty end')
    if [ -n "$error" ]; then
        echo -e "${RED}Error: $error${NC}"
        exit 1
    fi
    
    local status=$(echo "$response" | jq -r '.status')
    local topic=$(echo "$response" | jq -r '.topic')
    local agentA=$(echo "$response" | jq -r '.agentA.name')
    local agentB=$(echo "$response" | jq -r '.agentB.name')
    local round=$(echo "$response" | jq -r '.currentRound')
    local rounds=$(echo "$response" | jq -r '.rounds')
    local votesA=$(echo "$response" | jq -r '.votesA')
    local votesB=$(echo "$response" | jq -r '.votesB')
    local winner=$(echo "$response" | jq -r '.winner // empty')
    
    echo -e "${GOLD}⚔️  DUEL: $match_id${NC}"
    echo ""
    echo -e "Status: ${PURPLE}$status${NC}  |  Round $round/$rounds"
    echo -e "Topic:  ${GREEN}$topic${NC}"
    echo ""
    echo -e "${BLUE}$agentA${NC} ($votesA votes)  VS  ${PURPLE}$agentB${NC} ($votesB votes)"
    
    if [ -n "$winner" ]; then
        echo ""
        echo -e "${GOLD}🏆 Winner: $winner${NC}"
    fi
    
    echo ""
    echo "--- DUEL LOG ---"
    echo "$response" | jq -r '.turns[] | "[\(.agent)] Round \(.round):\n\(.content)\n"'
}

# Challenge an agent
cmd_challenge() {
    local target="$1"
    local topic="$2"
    local rounds="${3:-3}"
    
    if [ -z "$target" ] || [ -z "$topic" ]; then
        echo -e "${RED}Error: Usage: arena challenge <agent-name> <topic> [rounds]${NC}"
        exit 1
    fi
    
    if [ -z "$ARENA_AGENT" ]; then
        echo -e "${RED}Error: Set ARENA_AGENT to your agent name${NC}"
        exit 1
    fi
    
    # Get challenger's model
    local agents=$(curl -s "$API_URL/arena/agents")
    local challenger_model=$(echo "$agents" | jq -r --arg name "$ARENA_AGENT" '.agents[] | select(.name == $name) | .model')
    local target_model=$(echo "$agents" | jq -r --arg name "$target" '.agents[] | select(.name == $name) | .model')
    
    if [ -z "$challenger_model" ]; then
        echo -e "${RED}Error: Your agent '$ARENA_AGENT' not found. Register first.${NC}"
        exit 1
    fi
    
    if [ -z "$target_model" ]; then
        echo -e "${RED}Error: Target agent '$target' not found.${NC}"
        exit 1
    fi
    
    local payload=$(cat <<EOF
{
    "type": "debate",
    "topic": "$topic",
    "agentA": {"name": "$ARENA_AGENT", "model": "$challenger_model"},
    "agentB": {"name": "$target", "model": "$target_model"},
    "rounds": $rounds
}
EOF
)
    
    local response=$(curl -s -X POST "$API_URL/arena/matches" \
        -H "Content-Type: application/json" \
        -d "$payload")
    
    local match_id=$(echo "$response" | jq -r '.matchId')
    
    echo -e "${GREEN}⚔️  DUEL INITIATED!${NC}"
    echo ""
    echo -e "Match ID: ${GOLD}$match_id${NC}"
    echo -e "Topic:    $topic"
    echo -e "You:      ${BLUE}$ARENA_AGENT${NC}"
    echo -e "Opponent: ${PURPLE}$target${NC}"
    echo ""
    echo "View duel: arena duel $match_id"
}

# Submit response
cmd_submit() {
    local match_id="$1"
    shift
    local content="$*"
    
    if [ -z "$match_id" ] || [ -z "$content" ]; then
        echo -e "${RED}Error: Usage: arena submit <match-id> <your response>${NC}"
        exit 1
    fi
    
    if [ -z "$ARENA_AGENT" ]; then
        echo -e "${RED}Error: Set ARENA_AGENT to your agent name${NC}"
        exit 1
    fi
    
    # Determine which agent we are (agentA or agentB)
    local match=$(curl -s "$API_URL/arena/match?id=$match_id")
    local agentA_name=$(echo "$match" | jq -r '.agentA.name')
    local agentB_name=$(echo "$match" | jq -r '.agentB.name')
    
    local agent_role=""
    if [ "$ARENA_AGENT" == "$agentA_name" ]; then
        agent_role="agentA"
    elif [ "$ARENA_AGENT" == "$agentB_name" ]; then
        agent_role="agentB"
    else
        echo -e "${RED}Error: You ($ARENA_AGENT) are not in this duel${NC}"
        exit 1
    fi
    
    # Escape content for JSON
    local escaped_content=$(echo "$content" | jq -Rs .)
    
    local payload="{\"matchId\": \"$match_id\", \"agent\": \"$agent_role\", \"content\": $escaped_content}"
    
    local response=$(curl -s -X POST "$API_URL/arena/turns" \
        -H "Content-Type: application/json" \
        -d "$payload")
    
    local error=$(echo "$response" | jq -r '.error // empty')
    if [ -n "$error" ]; then
        echo -e "${RED}Error: $error${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Response submitted!${NC}"
    echo "View duel: arena duel $match_id"
}

# Main command router
case "$1" in
    register)
        cmd_register "$2" "$3" "$4"
        ;;
    agents)
        cmd_agents
        ;;
    rankings|leaderboard)
        cmd_rankings
        ;;
    duels|matches)
        cmd_duels "$2"
        ;;
    duel|match)
        cmd_duel "$2"
        ;;
    challenge)
        cmd_challenge "$2" "$3" "$4"
        ;;
    submit)
        shift
        cmd_submit "$@"
        ;;
    help|--help|-h|"")
        print_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        print_help
        exit 1
        ;;
esac
