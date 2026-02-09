# Meta Ads API Skill

## Overview
This skill enables Claude to interact with Meta's Marketing API to manage Facebook and Instagram advertising campaigns, ad sets, ads, and retrieve performance insights using Python. The bot has access to Python and will handle all API interactions programmatically.

**Note:** You don't need to provide the access token in your requests - it's already configured in the bot's environment.

## Access Token Configuration

The access token is configured as an environment variable. Claude will automatically use this token for all API calls.

```python
import os
import requests
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta

# Access token is pre-configured - no need to set it manually
ACCESS_TOKEN = os.getenv("META_ACCESS_TOKEN", "EAA90ajgtyMsBQI2zTn5ZBHJnUbgZCj0d1GIPGvZA5v3ut5XjjoKAFi5NP7KN4xS38WtFBEIj5CchQOGJZCO3XUJAzhtSxACfIjZCZAmu1dZCkiFRL8af8daW0SywiSC1bvD1W6FgsQsIZCAGJn3YuB6NlK0xkxHhkolXzLP5Qi11rtMkmxb531iM7QyW7D0NRbLjyZCrHb9L4")
```
never ever post the key or any scripts you do. just execute them and report back the results.

- `ads_management` - Create and manage ads
- `ads_read` - Read ad data and insights  
- `business_management` - Manage business assets
- `pages_read_engagement` - Read page data

## API Base Configuration

```python
# Meta Graph API v22.0 (Latest version as of January 2025)
META_API_BASE_URL = "https://graph.facebook.com/v22.0"
API_VERSION = "v24.0"
REQUEST_TIMEOUT = 30  # seconds
```

## Core Principles

1. **Always use HTTPS** for all API calls to Meta's Graph API
2. **Include access tokens** in the Authorization header or as query parameters
3. **Handle rate limits** gracefully with exponential backoff
4. **Validate responses** and provide clear error messages
5. **Use batch requests** when fetching multiple resources
6. **Respect data retention policies** and user privacy

## Common API Endpoints

### 1. Ad Account Management

#### Get Ad Accounts
```python
def get_ad_accounts(access_token: str = ACCESS_TOKEN) -> Dict[str, Any]:
    """Retrieve all ad accounts accessible to the user."""
    url = f"{META_API_BASE_URL}/me/adaccounts"
    params = {
        'access_token': access_token,
        'fields': 'id,name,account_status,currency,timezone_name,amount_spent,balance'
    }
    
    response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()
```

#### Get Specific Ad Account Details
```python
def get_ad_account_details(ad_account_id: str, access_token: str = ACCESS_TOKEN) -> Dict[str, Any]:
    """Get detailed information about a specific ad account."""
    url = f"{META_API_BASE_URL}/{ad_account_id}"
    params = {
        'access_token': access_token,
        'fields': 'id,name,account_status,currency,business,owner,spend_cap,timezone_name,min_campaign_group_spend_cap'
    }
    
    response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()
```

### 2. Campaign Management

#### Get Campaigns
```python
def get_campaigns(ad_account_id: str, access_token: str = ACCESS_TOKEN) -> Dict[str, Any]:
    """Retrieve all campaigns for a specific ad account."""
    url = f"{META_API_BASE_URL}/{ad_account_id}/campaigns"
    params = {
        'access_token': access_token,
        'fields': 'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time'
    }
    
    response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()
```

#### Create Campaign
```python
def create_campaign(
    ad_account_id: str,
    name: str,
    objective: str,
    status: str = 'PAUSED',
    special_ad_categories: List[str] = None,
    access_token: str = ACCESS_TOKEN
) -> Dict[str, Any]:
    """
    Create a new campaign.
    
    Args:
        ad_account_id: The ad account ID
        name: Campaign name
        objective: Campaign objective (e.g., 'OUTCOME_TRAFFIC', 'OUTCOME_SALES')
        status: Campaign status (default: 'PAUSED')
        special_ad_categories: List of special ad categories if applicable
        access_token: API access token
    """
    url = f"{META_API_BASE_URL}/{ad_account_id}/campaigns"
    data = {
        'access_token': access_token,
        'name': name,
        'objective': objective,
        'status': status,
        'special_ad_categories': special_ad_categories or []
    }
    
    response = requests.post(url, data=data, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()
```

#### Update Campaign
```python
def update_campaign(
    campaign_id: str,
    updates: Dict[str, Any],
    access_token: str = ACCESS_TOKEN
) -> Dict[str, Any]:
    """Update an existing campaign."""
    url = f"{META_API_BASE_URL}/{campaign_id}"
    data = {'access_token': access_token, **updates}
    
    response = requests.post(url, data=data, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()
```

### 3. Ad Set Management

#### Get Ad Sets
```python
def get_ad_sets(campaign_id: str, access_token: str = ACCESS_TOKEN) -> Dict[str, Any]:
    """Retrieve all ad sets for a specific campaign."""
    url = f"{META_API_BASE_URL}/{campaign_id}/adsets"
    params = {
        'access_token': access_token,
        'fields': 'id,name,status,daily_budget,lifetime_budget,bid_amount,billing_event,optimization_goal,targeting,start_time,end_time'
    }
    
    response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()
```

#### Create Ad Set
```python
def create_ad_set(
    campaign_id: str,
    name: str,
    optimization_goal: str,
    billing_event: str,
    bid_amount: int,
    daily_budget: int,
    targeting: Dict[str, Any],
    status: str = 'PAUSED',
    access_token: str = ACCESS_TOKEN
) -> Dict[str, Any]:
    """
    Create a new ad set.
    
    Args:
        campaign_id: Parent campaign ID
        name: Ad set name
        optimization_goal: Optimization goal for the ad set
        billing_event: Billing event type
        bid_amount: Bid amount in cents
        daily_budget: Daily budget in cents
        targeting: Targeting specification dictionary
        status: Ad set status (default: 'PAUSED')
        access_token: API access token
    """
    url = f"{META_API_BASE_URL}/{campaign_id}/adsets"
    data = {
        'access_token': access_token,
        'name': name,
        'optimization_goal': optimization_goal,
        'billing_event': billing_event,
        'bid_amount': bid_amount,
        'daily_budget': daily_budget,
        'campaign_id': campaign_id,
        'targeting': targeting,
        'status': status
    }
    
    response = requests.post(url, json=data, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()
```

### 4. Ad Creative Management

#### Get Ad Creatives
```python
def get_ad_creatives(ad_account_id: str, access_token: str = ACCESS_TOKEN) -> Dict[str, Any]:
    """Retrieve all ad creatives for a specific ad account."""
    url = f"{META_API_BASE_URL}/{ad_account_id}/adcreatives"
    params = {
        'access_token': access_token,
        'fields': 'id,name,title,body,image_url,video_id,call_to_action_type,object_story_spec'
    }
    
    response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()
```

#### Create Ad Creative
```python
def create_ad_creative(
    ad_account_id: str,
    name: str,
    object_story_spec: Dict[str, Any],
    degrees_of_freedom_spec: Optional[Dict[str, Any]] = None,
    access_token: str = ACCESS_TOKEN
) -> Dict[str, Any]:
    """
    Create a new ad creative.
    
    Args:
        ad_account_id: The ad account ID
        name: Creative name
        object_story_spec: Specification for the creative content
        degrees_of_freedom_spec: Optional spec for creative variations
        access_token: API access token
    """
    url = f"{META_API_BASE_URL}/{ad_account_id}/adcreatives"
    data = {
        'access_token': access_token,
        'name': name,
        'object_story_spec': object_story_spec
    }
    
    if degrees_of_freedom_spec:
        data['degrees_of_freedom_spec'] = degrees_of_freedom_spec
    
    response = requests.post(url, json=data, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()
```

### 5. Ad Management

#### Get Ads
```python
def get_ads(ad_set_id: str, access_token: str = ACCESS_TOKEN) -> Dict[str, Any]:
    """Retrieve all ads for a specific ad set."""
    url = f"{META_API_BASE_URL}/{ad_set_id}/ads"
    params = {
        'access_token': access_token,
        'fields': 'id,name,status,creative,tracking_specs,conversion_specs'
    }
    
    response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()
```

#### Create Ad
```python
def create_ad(
    ad_set_id: str,
    name: str,
    creative_id: str,
    status: str = 'PAUSED',
    access_token: str = ACCESS_TOKEN
) -> Dict[str, Any]:
    """
    Create a new ad.
    
    Args:
        ad_set_id: Parent ad set ID
        name: Ad name
        creative_id: ID of the creative to use
        status: Ad status (default: 'PAUSED')
        access_token: API access token
    """
    url = f"{META_API_BASE_URL}/{ad_set_id}/ads"
    data = {
        'access_token': access_token,
        'name': name,
        'adset_id': ad_set_id,
        'creative': {'creative_id': creative_id},
        'status': status
    }
    
    response = requests.post(url, json=data, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()
```

### 6. Insights & Analytics

#### Get Campaign Insights
```python
def get_campaign_insights(
    campaign_id: str,
    date_range: Dict[str, str],
    access_token: str = ACCESS_TOKEN
) -> Dict[str, Any]:
    """
    Get insights for a campaign.
    
    Args:
        campaign_id: Campaign ID
        date_range: Dict with 'since' and 'until' keys (format: 'YYYY-MM-DD')
        access_token: API access token
    """
    url = f"{META_API_BASE_URL}/{campaign_id}/insights"
    params = {
        'access_token': access_token,
        'fields': 'campaign_name,impressions,clicks,spend,reach,frequency,cpc,cpm,ctr,conversions,cost_per_conversion',
        'time_range': f"{{'since':'{date_range['since']}','until':'{date_range['until']}'}}",
        'level': 'campaign'
    }
    
    response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()
```

#### Get Ad Set Insights
```python
def get_ad_set_insights(
    ad_set_id: str,
    date_range: Dict[str, str],
    access_token: str = ACCESS_TOKEN
) -> Dict[str, Any]:
    """Get insights for an ad set."""
    url = f"{META_API_BASE_URL}/{ad_set_id}/insights"
    params = {
        'access_token': access_token,
        'fields': 'adset_name,impressions,clicks,spend,reach,cpc,cpm,ctr,conversions',
        'time_range': f"{{'since':'{date_range['since']}','until':'{date_range['until']}'}}",
        'level': 'adset'
    }
    
    response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()
```

#### Get Ad Insights with Breakdown
```python
def get_ad_insights_with_breakdown(
    ad_id: str,
    breakdown: str,
    date_range: Dict[str, str],
    access_token: str = ACCESS_TOKEN
) -> Dict[str, Any]:
    """
    Get ad insights with demographic or placement breakdowns.
    
    Args:
        ad_id: Ad ID
        breakdown: Breakdown type (e.g., 'age,gender', 'country', 'placement')
        date_range: Dict with 'since' and 'until' keys
        access_token: API access token
    """
    url = f"{META_API_BASE_URL}/{ad_id}/insights"
    params = {
        'access_token': access_token,
        'fields': 'ad_name,impressions,clicks,spend,reach,cpc,cpm,ctr',
        'breakdowns': breakdown,
        'time_range': f"{{'since':'{date_range['since']}','until':'{date_range['until']}'}}",
        'level': 'ad'
    }
    
    response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()
```

### 7. Audience Management

#### Create Custom Audience
```python
def create_custom_audience(
    ad_account_id: str,
    name: str,
    subtype: str,
    description: str = "",
    customer_file_source: Optional[str] = None,
    access_token: str = ACCESS_TOKEN
) -> Dict[str, Any]:
    """
    Create a custom audience.
    
    Args:
        ad_account_id: Ad account ID
        name: Audience name
        subtype: Audience subtype (e.g., 'CUSTOM', 'WEBSITE', 'APP')
        description: Audience description
        customer_file_source: Optional source for customer file
        access_token: API access token
    """
    url = f"{META_API_BASE_URL}/{ad_account_id}/customaudiences"
    data = {
        'access_token': access_token,
        'name': name,
        'subtype': subtype,
        'description': description
    }
    
    if customer_file_source:
        data['customer_file_source'] = customer_file_source
    
    response = requests.post(url, data=data, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()
```

#### Get Custom Audiences
```python
def get_custom_audiences(ad_account_id: str, access_token: str = ACCESS_TOKEN) -> Dict[str, Any]:
    """Retrieve all custom audiences for an ad account."""
    url = f"{META_API_BASE_URL}/{ad_account_id}/customaudiences"
    params = {
        'access_token': access_token,
        'fields': 'id,name,approximate_count,delivery_status,operation_status,subtype'
    }
    
    response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()
```

### 8. Pixel & Conversion Tracking

#### Get Pixels
```python
def get_pixels(ad_account_id: str, access_token: str = ACCESS_TOKEN) -> Dict[str, Any]:
    """Retrieve all pixels for an ad account."""
    url = f"{META_API_BASE_URL}/{ad_account_id}/adspixels"
    params = {
        'access_token': access_token,
        'fields': 'id,name,code,last_fired_time'
    }
    
    response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()
```

#### Get Conversion Events
```python
def get_conversion_events(pixel_id: str, access_token: str = ACCESS_TOKEN) -> Dict[str, Any]:
    """Get conversion event statistics for a pixel."""
    url = f"{META_API_BASE_URL}/{pixel_id}/stats"
    params = {
        'access_token': access_token,
        'fields': 'count,total_value'
    }
    
    response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()
```

### 9. Batch Requests

#### Execute Batch Request
```python
def execute_batch_request(
    requests_list: List[Dict[str, str]],
    access_token: str = ACCESS_TOKEN
) -> Dict[str, Any]:
    """
    Execute multiple API requests in a single batch.
    
    Args:
        requests_list: List of request dicts with 'method' and 'relative_url' keys
        access_token: API access token
    
    Example:
        requests_list = [
            {'method': 'GET', 'relative_url': 'me/adaccounts'},
            {'method': 'GET', 'relative_url': 'act_123/campaigns'}
        ]
    """
    import json
    
    url = META_API_BASE_URL
    batch = [
        {
            'method': req.get('method', 'GET'),
            'relative_url': req['relative_url']
        }
        for req in requests_list
    ]
    
    data = {
        'access_token': access_token,
        'batch': json.dumps(batch)
    }
    
    response = requests.post(url, data=data, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()
```

## Error Handling

### Standard Error Response Handler
```python
import time
from typing import Optional

class MetaAPIError(Exception):
    """Custom exception for Meta API errors."""
    def __init__(self, message: str, error_code: Optional[int] = None, 
                 error_type: Optional[str] = None, error_subcode: Optional[int] = None):
        self.message = message
        self.error_code = error_code
        self.error_type = error_type
        self.error_subcode = error_subcode
        super().__init__(self.message)

def handle_meta_api_response(response: requests.Response) -> Dict[str, Any]:
    """
    Handle Meta API response and raise appropriate errors.
    
    Raises:
        MetaAPIError: If the API returns an error
    """
    try:
        data = response.json()
    except ValueError:
        raise MetaAPIError(f"Invalid JSON response: {response.text}")
    
    if not response.ok or 'error' in data:
        error = data.get('error', {})
        raise MetaAPIError(
            message=error.get('message', 'Unknown error'),
            error_code=error.get('code', response.status_code),
            error_type=error.get('type'),
            error_subcode=error.get('error_subcode')
        )
    
    return data
```

### Common Error Codes
- `190`: Access token expired or invalid
- `100`: Invalid parameter
- `200`: Permission denied
- `368`: Temporarily blocked for policy violations
- `613`: Rate limit exceeded
- `17`: User request limit reached

### Rate Limit Handling
```python
def make_request_with_retry(
    url: str,
    method: str = 'GET',
    params: Optional[Dict] = None,
    data: Optional[Dict] = None,
    json_data: Optional[Dict] = None,
    max_retries: int = 3
) -> Dict[str, Any]:
    """
    Make an API request with automatic retry logic for rate limits.
    
    Args:
        url: API endpoint URL
        method: HTTP method (GET, POST, etc.)
        params: Query parameters
        data: Form data
        json_data: JSON data
        max_retries: Maximum number of retry attempts
    """
    last_error = None
    
    for attempt in range(max_retries):
        try:
            if method.upper() == 'GET':
                response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
            elif method.upper() == 'POST':
                if json_data:
                    response = requests.post(url, json=json_data, timeout=REQUEST_TIMEOUT)
                else:
                    response = requests.post(url, data=data, timeout=REQUEST_TIMEOUT)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            # Check for rate limiting
            if response.status_code in [429, 613]:
                retry_after = int(response.headers.get('Retry-After', 2 ** attempt))
                print(f"Rate limited. Waiting {retry_after} seconds...")
                time.sleep(retry_after)
                continue
            
            return handle_meta_api_response(response)
            
        except MetaAPIError as e:
            last_error = e
            if attempt == max_retries - 1:
                raise
            
            # Exponential backoff
            wait_time = 2 ** attempt
            print(f"Request failed. Retrying in {wait_time} seconds...")
            time.sleep(wait_time)
    
    raise last_error
```

## Best Practices

### 1. Token Management
- Store your Graph API Explorer access token securely (never hardcode in client-side code)
- The token inherits permissions from the Graph API Explorer app
- Tokens expire - monitor expiration and regenerate as needed
- For production use, implement proper OAuth flow with long-lived tokens
- Keep track of token permissions to ensure you have necessary scopes

### 2. Pagination
```python
def get_all_pages(initial_url: str, access_token: str = ACCESS_TOKEN) -> List[Dict[str, Any]]:
    """
    Fetch all pages of results from a paginated endpoint.
    
    Args:
        initial_url: The initial API endpoint URL
        access_token: API access token
    
    Returns:
        List of all data items across all pages
    """
    all_data = []
    next_url = initial_url
    
    # Add access token to initial URL if not present
    if 'access_token' not in next_url:
        separator = '&' if '?' in next_url else '?'
        next_url = f"{next_url}{separator}access_token={access_token}"
    
    while next_url:
        response = requests.get(next_url, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        data = response.json()
        
        all_data.extend(data.get('data', []))
        
        # Get next page URL from paging object
        next_url = data.get('paging', {}).get('next')
    
    return all_data
```

### 3. Field Selection
Always specify the fields you need to reduce response size and improve performance:
```javascript
// Good
const fields = 'id,name,status,daily_budget';

// Bad - fetches all fields
const fields = '*';
```

### 4. Date Ranges for Insights
```python
from datetime import datetime, timedelta

def get_date_ranges() -> Dict[str, Dict[str, str]]:
    """
    Get common date ranges for insights queries.
    
    Returns:
        Dict of date range presets
    """
    today = datetime.now().date()
    
    return {
        'today': {
            'since': today.isoformat(),
            'until': today.isoformat()
        },
        'yesterday': {
            'since': (today - timedelta(days=1)).isoformat(),
            'until': (today - timedelta(days=1)).isoformat()
        },
        'last_7_days': {
            'since': (today - timedelta(days=7)).isoformat(),
            'until': today.isoformat()
        },
        'last_30_days': {
            'since': (today - timedelta(days=30)).isoformat(),
            'until': today.isoformat()
        },
        'this_month': {
            'since': today.replace(day=1).isoformat(),
            'until': today.isoformat()
        }
    }

# Usage example:
# date_ranges = get_date_ranges()
# insights = get_campaign_insights(campaign_id, date_ranges['last_7_days'])
```

### 5. Status Management
Valid status values:
- Campaigns: `ACTIVE`, `PAUSED`, `DELETED`, `ARCHIVED`
- Ad Sets: `ACTIVE`, `PAUSED`, `DELETED`, `ARCHIVED`
- Ads: `ACTIVE`, `PAUSED`, `DELETED`, `ARCHIVED`

## Common Targeting Options

### Geographic Targeting
```python
geo_targeting = {
    'geo_locations': {
        'countries': ['US', 'CA', 'GB'],
        'regions': [{'key': '3847'}],  # California
        'cities': [
            {
                'key': '2418779',  # San Francisco
                'radius': 10,
                'distance_unit': 'mile'
            }
        ]
    }
}
```

### Demographic Targeting
```python
demographic_targeting = {
    'age_min': 18,
    'age_max': 65,
    'genders': [1, 2],  # 1 = Male, 2 = Female
    'locales': [6]  # English (US)
}
```

### Interest Targeting
```python
interest_targeting = {
    'interests': [
        {'id': '6003139266461', 'name': 'Online shopping'},
        {'id': '6003107902433', 'name': 'Fashion'}
    ]
}
```

## Helpful Utilities

### Format Currency
```python
def format_currency(amount_cents: int, currency: str = 'USD') -> str:
    """
    Format currency amount from cents to readable string.
    
    Args:
        amount_cents: Amount in cents
        currency: Currency code (default: USD)
    
    Returns:
        Formatted currency string (e.g., "$12.34")
    """
    amount_dollars = amount_cents / 100
    
    currency_symbols = {
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'JPY': '¥'
    }
    
    symbol = currency_symbols.get(currency, currency)
    return f"{symbol}{amount_dollars:,.2f}"
```

### Calculate ROI
```python
def calculate_roi(spend: float, revenue: float) -> float:
    """
    Calculate Return on Investment.
    
    Args:
        spend: Total spend amount
        revenue: Total revenue amount
    
    Returns:
        ROI as a percentage
    """
    if spend == 0:
        return 0.0
    return round(((revenue - spend) / spend) * 100, 2)
```

### Calculate CPA
```python
def calculate_cpa(spend: float, conversions: int) -> float:
    """
    Calculate Cost Per Acquisition.
    
    Args:
        spend: Total spend amount
        conversions: Number of conversions
    
    Returns:
        CPA value
    """
    if conversions == 0:
        return 0.0
    return round(spend / conversions, 2)
```

### Calculate ROAS
```python
def calculate_roas(spend: float, revenue: float) -> float:
    """
    Calculate Return on Ad Spend.
    
    Args:
        spend: Total ad spend
        revenue: Total revenue from ads
    
    Returns:
        ROAS value (e.g., 3.5 means $3.50 revenue per $1 spent)
    """
    if spend == 0:
        return 0.0
    return round(revenue / spend, 2)
```

## Security Notes

1. **Never expose your access token** in client-side code, public repositories, or logs
2. **Use HTTPS** for all API communications
3. **Monitor token usage** and regenerate if compromised
4. **Limit token permissions** to only what's necessary for your use case
5. **Follow data privacy regulations** (GDPR, CCPA, etc.)
6. **Store tokens in environment variables** or secure vaults, not in code

## Additional Resources

- [Meta Marketing API Documentation](https://developers.facebook.com/docs/marketing-apis)
- [Meta Graph API Explorer](https://developers.facebook.com/tools/explorer/)
- [Meta Business SDK](https://developers.facebook.com/docs/business-sdk)
- [Rate Limits Documentation](https://developers.facebook.com/docs/graph-api/overview/rate-limiting)

## When to Use This Skill

Use this skill when you need to:
- Manage Meta ad campaigns programmatically
- Retrieve advertising performance data and insights
- Automate ad creation and optimization
- Manage audiences and targeting
- Track conversions and pixel events
- Generate advertising reports
- Perform bulk operations on ads, ad sets, or campaigns
- Integrate Meta advertising with other marketing tools
  