import { gql } from '@apollo/client';

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(input: { email: $email, password: $password }) {
      accessToken
      refreshToken
      user {
        id
        email
        fullName
        role
        profilePictureUrl
      }
    }
  }
`;

export const REGISTER = gql`
  mutation Register(
    $email: String!
    $password: String!
    $fullName: String!
    $acceptTerms: Boolean!
    $marketingOptIn: Boolean
  ) {
    register(
      input: {
        email: $email
        password: $password
        fullName: $fullName
        acceptTerms: $acceptTerms
        marketingOptIn: $marketingOptIn
      }
    ) {
      accessToken
      refreshToken
      user {
        id
        email
        fullName
        role
        profilePictureUrl
      }
    }
  }
`;

export const FORGOT_PASSWORD = gql`
  mutation ForgotPassword($email: String!) {
    forgotPassword(email: $email)
  }
`;

export const RESET_PASSWORD = gql`
  mutation ResetPassword($input: ResetPasswordInput!) {
    resetPassword(input: $input)
  }
`;

export const GET_LANDING_DATA = gql`
  query GetLandingData {
    landing {
      events {
        id
        title
        description
        date
        price
        imageUrl
        venue {
          name
        }
      }
      dJs {
        id
        name
        stageName
        bio
        genre
        profilePictureUrl
        coverImageUrl
        followerCount
      }
    }
  }
`;

export const GET_LANDING_HIGHLIGHTS = gql`
  query GetLandingHighlights {
    landingHighlights(limit: 6) {
      id
      title
      blurb
      coverImageUrl
      coverVideoUrl
      highlightDate
      eventId
      eventTitle
      upcomingEventId
      upcomingEventTitle
      media {
        id
        mediaUrl
        mediaType
        thumbnailUrl
      }
    }
  }
`;

export const ALL_HIGHLIGHTS = gql`
  query AllHighlights {
    allHighlights {
      id
      eventId
      eventTitle
      eventDate
      title
      blurb
      coverImageUrl
      coverVideoUrl
      highlightDate
      upcomingEventId
      upcomingEventTitle
      isPublished
      sortOrder
    }
  }
`;

export const CREATE_EVENT_HIGHLIGHT = gql`
  mutation CreateEventHighlight($input: CreateEventHighlightDtoInput!) {
    createEventHighlight(input: $input)
  }
`;

export const UPDATE_EVENT_HIGHLIGHT = gql`
  mutation UpdateEventHighlight($id: UUID!, $input: UpdateEventHighlightDtoInput!) {
    updateEventHighlight(id: $id, input: $input)
  }
`;

export const SET_HIGHLIGHT_PUBLISHED = gql`
  mutation SetHighlightPublished($id: UUID!, $published: Boolean!) {
    setHighlightPublished(id: $id, published: $published)
  }
`;

export const DELETE_EVENT_HIGHLIGHT = gql`
  mutation DeleteEventHighlight($id: UUID!) {
    deleteEventHighlight(id: $id)
  }
`;

export const GET_DJS = gql`
  query GetDJs {
    dJs {
      id
      userId
      name
      stageName
      bio
      genre
      profilePictureUrl
      coverImageUrl
      tagline
      followerCount
      averageRating
      reviewCount
      specialties
      achievements
      yearsExperience
      influencedBy
      upcomingEvents {
        eventId
        title
        date
        venueName
        city
      }
    }
  }
`;

export const GET_DJ_BY_ID = gql`
  query GetDjById($id: UUID!) {
    dj(id: $id) {
      id
      name
      stageName
      bio
      longBio
      tagline
      genre
      profilePictureUrl
      coverImageUrl
      specialties
      achievements
      yearsExperience
      influencedBy
      equipmentUsed
      topTracks
      followerCount
      upcomingEvents {
        eventId
        title
        date
        venueName
        city
        price
        imageUrl
      }
      socialLinks {
        label
        url
      }
    }
  }
`;

export const CREATE_DJ = gql`
  mutation CreateDj($input: CreateDjInput!) {
    createDj(input: $input)
  }
`;

export const UPDATE_DJ = gql`
  mutation UpdateDj($id: UUID!, $input: UpdateDjInput!) {
    updateDj(id: $id, input: $input)
  }
`;

export const DELETE_DJ = gql`
  mutation DeleteDj($id: UUID!) {
    deleteDj(id: $id)
  }
`;

export const GET_EVENTS = gql`
  query GetEvents {
    events {
      id
      title
      description
      date
      price
      imageUrl
      ticketingUrl
      genres
      venue {
        id
        name
        city
        imageUrl
        imageUrls
      }
    }
  }
`;

export const CREATE_EVENT = gql`
  mutation CreateEvent($input: CreateEventInput!) {
    createEvent(input: $input)
  }
`;

export const UPDATE_EVENT = gql`
  mutation UpdateEvent($id: UUID!, $input: UpdateEventInput!) {
    updateEvent(id: $id, input: $input)
  }
`;

export const DELETE_EVENT = gql`
  mutation DeleteEvent($id: UUID!) {
    deleteEvent(id: $id)
  }
`;

export const GET_EVENT_BY_ID = gql`
  query GetEventById($id: UUID!) {
    event(id: $id) {
      id
      title
      description
      date
      price
      venueId
      imageUrl
      videoUrl
      ticketingUrl
      genreIds
      djIds
      venue {
        id
        name
        description
        address
        city
        country
        imageUrl
        imageUrls
      }
    }
  }
`;

export const GET_GENRES = gql`
  query GetGenres {
    genres {
      id
      name
    }
  }
`;

export const CREATE_GENRE = gql`
  mutation CreateGenre($input: CreateGenreInput!) {
    createGenre(input: $input)
  }
`;

export const UPDATE_GENRE = gql`
  mutation UpdateGenre($id: UUID!, $input: UpdateGenreInput!) {
    updateGenre(id: $id, input: $input)
  }
`;

export const GET_NEWSLETTER_SUBSCRIBERS = gql`
  query GetNewsletterSubscribers {
    newsletters {
      id
      email
      subscribedAt
      userId
    }
  }
`;

export const UNSUBSCRIBE_NEWSLETTER = gql`
  mutation UnsubscribeNewsletter($id: UUID!) {
    unsubscribeNewsletter(id: $id)
  }
`;

export const GET_VENUES = gql`
  query GetVenues {
    venues {
      id
      name
      description
      address
      city
      country
      capacity
      contactEmail
      phoneNumber
      imageUrl
      imageUrls
    }
  }
`;

export const GET_VENUE_BY_ID = gql`
  query GetVenueById($id: UUID!) {
    venue(id: $id) {
      id
      name
      description
      address
      city
      country
      latitude
      longitude
      capacity
      contactEmail
      phoneNumber
      imageUrl
      imageUrls
    }
  }
`;

export const CREATE_VENUE = gql`
  mutation CreateVenue($input: CreateVenueInput!) {
    createVenue(input: $input)
  }
`;

export const UPDATE_VENUE = gql`
  mutation UpdateVenue($id: UUID!, $input: UpdateVenueInput!) {
    updateVenue(id: $id, input: $input)
  }
`;

export const DELETE_VENUE = gql`
  mutation DeleteVenue($id: UUID!) {
    deleteVenue(id: $id)
  }
`;

export const GET_DJ_TOP10_LISTS = gql`
  query GetDjTop10Lists {
    djTop10Lists {
      djId
      djStageName
      top10Songs {
        id
        djId
        songId
        songTitle
        song {
          id
          title
          artist
          genre
          duration
          coverImageUrl
          audioPreviewUrl
          spotifyUrl
          soundCloudUrl
        }
      }
    }
  }
`;

export const CREATE_DJ_TOP10_ENTRY = gql`
  mutation CreateDjTop10Entry($input: CreateDjTop10Input!) {
    createDjTop10Entry(input: $input)
  }
`;

export const DELETE_DJ_TOP10_ENTRY = gql`
  mutation DeleteDjTop10Entry($id: UUID!) {
    deleteDjTop10Entry(id: $id)
  }
`;

export const GET_SONGS = gql`
  query GetSongs {
    songs {
      id
      title
      artist
      genre
      duration
      coverImageUrl
      audioPreviewUrl
      spotifyUrl
      soundCloudUrl
    }
  }
`;

export const CREATE_SONG = gql`
  mutation CreateSong($input: CreateSongInput!) {
    createSong(input: $input)
  }
`;

export const FETCH_SONG_METADATA = gql`
  query FetchSongMetadata($url: String!) {
    fetchSongMetadata(url: $url) {
      title
      artist
      coverImageUrl
      spotifyUrl
      soundCloudUrl
    }
  }
`;

export const GET_FOLLOWED_DJS = gql`
  query GetFollowedDJs($userId: String!) {
    followedDjs(userId: $userId) {
      id
      name
      stageName
      bio
      genre
      profilePictureUrl
      followerCount
    }
  }
`;

export const IS_FOLLOWING_DJ = gql`
  query IsFollowingDj($userId: String!, $djId: UUID!) {
    isFollowingDj(userId: $userId, djId: $djId)
  }
`;

export const FOLLOW_DJ = gql`
  mutation FollowDj($input: FollowDjInput!) {
    followDj(input: $input)
  }
`;

export const UNFOLLOW_DJ = gql`
  mutation UnfollowDj($input: FollowDjInput!) {
    unfollowDj(input: $input)
  }
`;

export const SUBSCRIBE_NEWSLETTER = gql`
  mutation SubscribeNewsletter($email: String!, $userId: String!) {
    subscribeNewsletter(input: { email: $email, userId: $userId }) {
      id
      email
      subscribedAt
    }
  }
`;

// Temporary alias until dedicated push subscription mutations exist.
export const SUBSCRIBE_TO_PUSH = SUBSCRIBE_NEWSLETTER;

export const GET_USER_TICKETS = gql`
  query GetUserTickets($userId: String!) {
    ticketsByUser(userId: $userId) {
      id
      ticketNumber
      eventId
      totalPrice
      purchaseDate
      isValid
      isCheckedIn
      status
      qrCode
      admitCount
      admitsRemaining
      event {
        id
        title
        date
        venueName
        city
        imageUrl
      }
    }
  }
`;

export const GET_TICKETS_BY_EVENT = gql`
  query GetTicketsByEvent($eventId: UUID!) {
    ticketsByEvent(eventId: $eventId) {
      id
      ticketNumber
      userId
      totalPrice
      purchaseDate
      isValid
      isCheckedIn
    }
  }
`;

export const PURCHASE_TICKET = gql`
  mutation PurchaseTicket($input: PurchaseTicketInput!) {
    purchaseTicket(input: $input) {
      id
      ticketNumber
      totalPrice
      purchaseDate
      event {
        id
        title
        date
      }
    }
  }
`;

export const CHECK_IN_TICKET = gql`
  mutation CheckInTicket($ticketId: UUID!) {
    checkInTicket(ticketId: $ticketId)
  }
`;

export const INVALIDATE_TICKET = gql`
  mutation InvalidateTicket($ticketId: UUID!) {
    invalidateTicket(ticketId: $ticketId)
  }
`;

export const DELETE_TICKET = gql`
  mutation DeleteTicket($ticketId: UUID!) {
    deleteTicket(ticketId: $ticketId)
  }
`;

export const GET_SITE_SETTINGS = gql`
  query GetSiteSettings {
    siteSettings {
      id
      siteName
      tagline
      logoUrl
      faviconUrl
      primaryColor
      secondaryColor
      accentColor
      heroTitle
      heroSubtitle
      heroCtaText
      heroCtaLink
      heroBackgroundImageUrl
      heroBackgroundVideoUrl
      heroOverlayOpacity
      heroGenres
      heroLocation
      heroVibes
      brandHeadline
      brandNarrative
      eventsHeading
      eventsTagline
      cultureHeading
      conceptHeading
      lineupHeading
      galleryVideoUrl
      contactEmail
      contactPhone
      contactAddress
      facebookUrl
      instagramUrl
      twitterUrl
      youTubeUrl
      tikTokUrl
      soundCloudUrl
      defaultEventImageUrl
      defaultDjImageUrl
      defaultVenueImageUrl
      enableNewsletter
      enableNotifications
      enableReviews
      enableGamification
      enableSubscriptions
      metaDescription
      metaKeywords
      footerText
      copyrightText
    }
  }
`;

export const UPDATE_SITE_SETTINGS = gql`
  mutation UpdateSiteSettings($input: UpdateSiteSettingsInput!) {
    updateSiteSettings(input: $input) {
      id
      siteName
      tagline
      logoUrl
      faviconUrl
      primaryColor
      secondaryColor
      accentColor
      heroTitle
      heroSubtitle
      heroCtaText
      heroCtaLink
      heroBackgroundImageUrl
      heroBackgroundVideoUrl
      heroOverlayOpacity
      heroGenres
      heroLocation
      heroVibes
      brandHeadline
      brandNarrative
      eventsHeading
      eventsTagline
      cultureHeading
      conceptHeading
      lineupHeading
      galleryVideoUrl
      contactEmail
      contactPhone
      contactAddress
      facebookUrl
      instagramUrl
      twitterUrl
      youTubeUrl
      tikTokUrl
      soundCloudUrl
      defaultEventImageUrl
      defaultDjImageUrl
      defaultVenueImageUrl
      enableNewsletter
      enableNotifications
      enableReviews
      enableGamification
      enableSubscriptions
      metaDescription
      metaKeywords
      footerText
      copyrightText
    }
  }
`;

export const CREATE_CONTACT_MESSAGE = gql`
  mutation CreateContactMessage($input: CreateContactMessageInput!) {
    createContactMessage(input: $input) {
      id
      userId
      message
    }
  }
`;

export const GET_GALLERY_MEDIA = gql`
  query GetGalleryMedia($approvedOnly: Boolean) {
    galleryMedia(approvedOnly: $approvedOnly) {
      id
      title
      description
      mediaUrl
      mediaType
      thumbnailUrl
      userId
      userName
      eventId
      eventTitle
      uploadedAt
      isApproved
      isFeatured
      viewCount
      likeCount
      tags
    }
  }
`;

export const GET_FEATURED_GALLERY_MEDIA = gql`
  query GetFeaturedGalleryMedia {
    featuredGalleryMedia {
      id
      title
      description
      mediaUrl
      mediaType
      thumbnailUrl
      userId
      userName
      eventId
      eventTitle
      uploadedAt
      isApproved
      isFeatured
      viewCount
      likeCount
      tags
    }
  }
`;

export const CREATE_GALLERY_MEDIA = gql`
  mutation CreateGalleryMedia($input: CreateGalleryMediaInput!) {
    createGalleryMedia(input: $input)
  }
`;

export const UPDATE_GALLERY_MEDIA = gql`
  mutation UpdateGalleryMedia($id: UUID!, $input: UpdateGalleryMediaInput!) {
    updateGalleryMedia(id: $id, input: $input)
  }
`;

export const DELETE_GALLERY_MEDIA = gql`
  mutation DeleteGalleryMedia($id: UUID!) {
    deleteGalleryMedia(id: $id)
  }
`;

export const LIKE_GALLERY_MEDIA = gql`
  mutation LikeGalleryMedia($id: UUID!) {
    likeGalleryMedia(id: $id)
  }
`;

// DJ APPLICATION QUERIES & MUTATIONS
export const SUBMIT_DJ_APPLICATION = gql`
  mutation SubmitDJApplication($input: CreateDJApplicationInput!) {
    submitDJApplication(input: $input) {
      id
      userId
      stageName
      bio
      genre
      yearsExperience
      status
      submittedAt
    }
  }
`;

export const GET_DJ_APPLICATION_BY_USER = gql`
  query GetDJApplicationByUser($userId: String!) {
    djApplicationByUser(userId: $userId) {
      id
      userId
      stageName
      bio
      genre
      yearsExperience
      specialties
      influencedBy
      equipmentUsed
      socialLinks
      profileImageUrl
      coverImageUrl
      status
      submittedAt
      reviewedAt
      rejectionReason
    }
  }
`;

export const HAS_PENDING_DJ_APPLICATION = gql`
  query HasPendingDJApplication($userId: String!) {
    hasPendingDjApplication(userId: $userId)
  }
`;

export const GET_PENDING_DJ_APPLICATIONS = gql`
  query GetPendingDJApplications {
    pendingDjApplications {
      id
      userId
      stageName
      bio
      genre
      yearsExperience
      specialties
      influencedBy
      equipmentUsed
      socialLinks
      profileImageUrl
      coverImageUrl
      status
      submittedAt
      userEmail
      userName
    }
  }
`;

export const APPROVE_DJ_APPLICATION = gql`
  mutation ApproveDJApplication($applicationId: UUID!, $reviewedByAdminId: String!) {
    approveDJApplication(applicationId: $applicationId, reviewedByAdminId: $reviewedByAdminId) {
      id
      status
      reviewedAt
    }
  }
`;

export const REJECT_DJ_APPLICATION = gql`
  mutation RejectDJApplication($applicationId: UUID!, $reviewedByAdminId: String!, $rejectionReason: String) {
    rejectDJApplication(applicationId: $applicationId, reviewedByAdminId: $reviewedByAdminId, rejectionReason: $rejectionReason) {
      id
      status
      reviewedAt
      rejectionReason
    }
  }
`;

export const GET_USER_BY_ID = gql`
  query GetUserById($userId: String!) {
    userById(userId: $userId) {
      fullName
      email
      profilePictureUrl
    }
  }
`;

export const UPDATE_USER_PROFILE = gql`
  mutation UpdateUserProfile($input: UpdateUserProfileInput!) {
    updateUserProfile(input: $input)
  }
`;

// DJ REVIEW QUERIES & MUTATIONS
export const GET_DJ_REVIEWS = gql`
  query GetDJReviews($djId: UUID!) {
    djReviews(djId: $djId) {
      id
      djId
      userId
      userName
      rating
      comment
      createdAt
    }
  }
`;

export const CREATE_DJ_REVIEW = gql`
  mutation CreateDJReview($input: CreateDJReviewInput!) {
    createDjReview(input: $input)
  }
`;

// ADMIN USER QUERIES
export const GET_USERS = gql`
  query GetUsers {
    users {
      id
      fullName
      email
      passwordHash
      role
      isEmailVerified
      provider
      profilePictureUrl
      createdAt
      updatedAt
      lastLoginAt
    }
  }
`;

export const UPDATE_USER_ROLE = gql`
  mutation UpdateUserRole($userId: String!, $role: Int!) {
    updateUserRole(userId: $userId, role: $role)
  }
`;

export const DELETE_USER = gql`
  mutation DeleteUser($userId: String!) {
    deleteUser(userId: $userId)
  }
`;

// PLAYLIST QUERIES & MUTATIONS
export const GET_PLAYLISTS = gql`
  query GetPlaylists {
    playlists {
      id
      title
      description
      genre
      coverImageUrl
      curator
      playlistUrl
      djProfileId
      djName
      createdAt
      songs {
        id
        songId
        position
        title
        artist
        genre
        coverImageUrl
        spotifyUrl
        soundCloudUrl
      }
    }
  }
`;

export const GET_PLAYLIST_BY_ID = gql`
  query GetPlaylistById($id: UUID!) {
    playlist(id: $id) {
      id
      title
      description
      genre
      coverImageUrl
      curator
      playlistUrl
      djProfileId
      djName
      createdAt
      songs {
        id
        songId
        position
        title
        artist
        genre
        coverImageUrl
        spotifyUrl
        soundCloudUrl
      }
    }
  }
`;

export const GET_MY_DJ_PLAYLISTS = gql`
  query GetMyDjPlaylists($djProfileId: UUID!) {
    myDjPlaylists(djProfileId: $djProfileId) {
      id
      title
      description
      genre
      coverImageUrl
      curator
      playlistUrl
      djProfileId
      djName
      createdAt
      songs {
        id
        songId
        position
        title
        artist
        genre
        coverImageUrl
        spotifyUrl
        soundCloudUrl
      }
    }
  }
`;

export const CREATE_PLAYLIST = gql`
  mutation CreatePlaylist($input: CreatePlaylistInput!) {
    createPlaylist(input: $input)
  }
`;

export const UPDATE_PLAYLIST = gql`
  mutation UpdatePlaylist($id: UUID!, $input: UpdatePlaylistInput!) {
    updatePlaylist(id: $id, input: $input)
  }
`;

export const DELETE_PLAYLIST = gql`
  mutation DeletePlaylist($id: UUID!) {
    deletePlaylist(id: $id)
  }
`;

export const ADD_PLAYLIST_SONG = gql`
  mutation AddPlaylistSong($input: AddPlaylistSongInput!) {
    addPlaylistSong(input: $input)
  }
`;

export const REMOVE_PLAYLIST_SONG = gql`
  mutation RemovePlaylistSong($id: UUID!) {
    removePlaylistSong(id: $id)
  }
`;

// DJ MIXES QUERIES & MUTATIONS
export const GET_DJ_MIXES = gql`
  query GetDjMixes {
    djMixes {
      id
      title
      description
      mixUrl
      thumbnailUrl
      genre
      mixType
      djProfileId
      djName
      createdAt
    }
  }
`;

export const CREATE_DJ_MIX = gql`
  mutation CreateDjMix($input: CreateDJMixInput!) {
    createDjMix(input: $input)
  }
`;

export const UPDATE_DJ_MIX = gql`
  mutation UpdateDjMix($id: UUID!, $input: UpdateDJMixInput!) {
    updateDjMix(id: $id, input: $input)
  }
`;

export const DELETE_DJ_MIX = gql`
  mutation DeleteDjMix($id: UUID!) {
    deleteDjMix(id: $id)
  }
`;

// ─── Event Organizer ───────────────────────────────────────────────────────

export const GET_ORGANIZER_APPLICATION_BY_USER = gql`
  query GetOrganizerApplicationByUser($userId: String!) {
    organizerApplicationByUser(userId: $userId) {
      id
      userId
      organizationName
      description
      website
      socialLinks
      status
      submittedAt
      reviewedAt
      rejectionReason
    }
  }
`;

export const GET_ORGANIZER_APPLICATIONS = gql`
  query GetOrganizerApplications {
    organizerApplications {
      id
      userId
      organizationName
      description
      website
      status
      submittedAt
      reviewedAt
      rejectionReason
    }
  }
`;

export const GET_MY_ORGANIZER_EVENTS = gql`
  query GetMyOrganizerEvents($userId: String!) {
    myOrganizerEvents(userId: $userId) {
      id
      title
      description
      date
      price
      imageUrl
      status
      statusReason
      organizerId
      genres
      venue {
        id
        name
        city
      }
    }
  }
`;

export const GET_PENDING_EVENTS = gql`
  query GetPendingEvents {
    pendingEvents {
      id
      title
      description
      date
      price
      imageUrl
      status
      organizerId
      genres
      venue {
        id
        name
        city
      }
    }
  }
`;

export const SUBMIT_ORGANIZER_APPLICATION = gql`
  mutation SubmitOrganizerApplication($input: CreateOrganizerApplicationInput!) {
    submitOrganizerApplication(input: $input) {
      id
      status
      submittedAt
    }
  }
`;

export const APPROVE_ORGANIZER_APPLICATION = gql`
  mutation ApproveOrganizerApplication($applicationId: UUID!) {
    approveOrganizerApplication(applicationId: $applicationId) {
      id
      status
    }
  }
`;

export const REJECT_ORGANIZER_APPLICATION = gql`
  mutation RejectOrganizerApplication($applicationId: UUID!, $rejectionReason: String) {
    rejectOrganizerApplication(applicationId: $applicationId, rejectionReason: $rejectionReason) {
      id
      status
    }
  }
`;

export const CREATE_EVENT_AS_ORGANIZER = gql`
  mutation CreateEventAsOrganizer($input: CreateEventInput!) {
    createEventAsOrganizer(input: $input)
  }
`;

export const UPDATE_EVENT_AS_ORGANIZER = gql`
  mutation UpdateEventAsOrganizer($id: UUID!, $input: UpdateEventInput!) {
    updateEventAsOrganizer(id: $id, input: $input)
  }
`;

export const DELETE_EVENT_AS_ORGANIZER = gql`
  mutation DeleteEventAsOrganizer($id: UUID!) {
    deleteEventAsOrganizer(id: $id)
  }
`;

export const APPROVE_EVENT = gql`
  mutation ApproveEvent($id: UUID!) {
    approveEvent(id: $id)
  }
`;

export const REJECT_EVENT = gql`
  mutation RejectEvent($id: UUID!, $reason: String!) {
    rejectEvent(id: $id, reason: $reason)
  }
`;
