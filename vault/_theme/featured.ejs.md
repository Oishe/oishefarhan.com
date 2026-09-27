<% for (const item of items) { %>
::: {.feature}
[Featured writing]{.feature-kicker}

## [<%= item.title %>](<%- item.path %>){.feature-link}

<%- item.abstract %>

[Read the article →]{.feature-cta}
:::
<% } %>
